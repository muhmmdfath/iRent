import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, open, realpath, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { AuthContext, AuthService } from '../../auth/auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { SettingsService } from '../settings/settings.service';

export const MAX_MEDIA_BYTES = 5 * 1024 * 1024;
export interface MediaUpload {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

@Injectable()
export class MediaService {
  private readonly root: string;
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly inventory: InventoryService,
    private readonly settings: SettingsService,
  ) {
    this.root = resolve(
      config.get<string>('MEDIA_STORAGE_DIR') ?? 'storage/media',
    );
  }
  async upload(
    context: AuthContext,
    folder: 'items' | 'qris',
    file: MediaUpload | undefined,
    itemId?: string,
  ) {
    // Recheck session before decoding or writing; the attach operation checks it again under lock.
    await this.prisma.$transaction((tx) =>
      this.auth.authorizeLocked(tx, context, 'admin'),
    );
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.size !== file.buffer.length ||
      file.size < 1 ||
      file.size > MAX_MEDIA_BYTES ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    )
      throw new BadRequestException('Gambar wajib JPG/PNG/WebP maksimal 5 MB.');
    let output: Buffer;
    try {
      const decoder = sharp(file.buffer, {
        limitInputPixels: 16000000,
        failOn: 'warning',
      });
      const meta = await decoder.metadata();
      const expected = {
        'image/png': 'png',
        'image/jpeg': 'jpeg',
        'image/webp': 'webp',
      }[file.mimetype];
      if (meta.format !== expected || (meta.pages ?? 1) !== 1)
        throw new Error('invalid image');
      // PNG preserves QR edges; no EXIF/XMP retained. QR is not resized to preserve scan fidelity.
      output =
        folder === 'qris'
          ? await decoder.rotate().png().toBuffer()
          : await decoder
              .rotate()
              .resize({
                width: 2048,
                height: 2048,
                fit: 'inside',
                withoutEnlargement: true,
              })
              .webp({ quality: 85 })
              .toBuffer();
    } catch {
      throw new BadRequestException(
        'Isi gambar rusak, terlalu besar, atau tidak sesuai format.',
      );
    }
    if (output.length > MAX_MEDIA_BYTES)
      throw new BadRequestException('Gambar hasil melebihi 5 MB.');
    const directory = join(this.root, folder);
    await mkdir(directory, { recursive: true });
    const filename = randomUUID() + (folder === 'qris' ? '.png' : '.webp');
    const local = join(directory, filename),
      path = `/media/${folder}/${filename}`;
    await writeFile(local, output, { flag: 'wx' });
    try {
      const result =
        folder === 'items'
          ? await this.inventory.updateItem(context, itemId!, {
              photoPath: path,
            })
          : await this.settings.update(context, { qris_image_path: path });
      return { path, result };
    } catch (error) {
      await unlink(local).catch(() => undefined);
      throw error;
    }
  }
  async download(folder: string, filename: string) {
    if (
      !['items', 'qris'].includes(folder) ||
      !/^[0-9a-f-]{36}\.(webp|png)$/.test(filename)
    )
      throw new NotFoundException('Gambar tidak ditemukan.');
    const directory = join(this.root, folder),
      path = join(directory, filename);
    try {
      const [actualDirectory, actualPath] = await Promise.all([
        realpath(directory),
        realpath(path),
      ]);
      if (dirname(actualPath) !== actualDirectory)
        throw new Error('unsafe path');
      const handle = await open(
        path,
        constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
      );
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > MAX_MEDIA_BYTES) {
        await handle.close();
        throw new Error('invalid file');
      }
      return {
        stream: handle.createReadStream(),
        mime: filename.endsWith('.png') ? 'image/png' : 'image/webp',
      };
    } catch {
      throw new NotFoundException('Gambar tidak ditemukan.');
    }
  }
}
