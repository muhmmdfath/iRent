import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const MAX_PROOF_BYTES = 2 * 1024 * 1024;
export interface ProofUpload {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class ProofStorageService {
  private readonly directory: string;
  constructor(config: ConfigService) {
    this.directory = resolve(
      config.get<string>('PROOF_STORAGE_DIR') ?? 'storage/proofs',
    );
  }
  async save(file: ProofUpload | undefined) {
    if (
      !file ||
      !Buffer.isBuffer(file.buffer) ||
      file.buffer.length !== file.size ||
      file.size < 1 ||
      file.size > MAX_PROOF_BYTES
    )
      throw new BadRequestException(
        'Bukti wajib berupa JPG/PNG/PDF maksimal 2 MB.',
      );
    const data = file.buffer;
    let extension: string | undefined;
    if (
      file.mimetype === 'image/jpeg' &&
      data.length >= 5 &&
      data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) &&
      data.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
    )
      extension = 'jpg';
    if (
      file.mimetype === 'image/png' &&
      data.length >= 33 &&
      data
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      data.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))
    )
      extension = 'png';
    if (
      file.mimetype === 'application/pdf' &&
      data.subarray(0, 5).toString('ascii') === '%PDF-' &&
      data.subarray(-1024).includes(Buffer.from('%%EOF'))
    )
      extension = 'pdf';
    if (!extension)
      throw new BadRequestException(
        'Isi file tidak sesuai format JPG/PNG/PDF.',
      );
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = randomUUID() + '.' + extension;
    try {
      await writeFile(join(this.directory, path), data, {
        flag: 'wx',
        mode: 0o600,
      });
    } catch (error) {
      await this.remove(path);
      throw error;
    }
    return {
      proofPath: path,
      mime: file.mimetype,
      size: file.size,
      fileHash: createHash('sha256').update(data).digest('hex'),
    };
  }
  private checkedPath(path: string) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|pdf)$/.test(path))
      throw new NotFoundException('Bukti tidak ditemukan.');
    return join(this.directory, path);
  }
  async remove(path: string) {
    try {
      await unlink(this.checkedPath(path));
    } catch (error) {
      if (!(
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ))
        throw error;
    }
  }
  async download(path: string) {
    const fullPath = this.checkedPath(path);
    try {
      if (!(await stat(fullPath)).isFile()) throw new NotFoundException();
    } catch {
      throw new NotFoundException('Bukti tidak ditemukan.');
    }
    return createReadStream(fullPath);
  }
}
