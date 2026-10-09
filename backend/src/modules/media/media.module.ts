import {
  Controller,
  Get,
  Header,
  Module,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthModule } from '../../auth/auth.module';
import {
  AuthRequest,
  ProofUploadRoute,
  Public,
  Roles,
} from '../../auth/auth.guard';
import { PrismaModule } from '../../prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SettingsModule } from '../settings/settings.module';
import { MAX_MEDIA_BYTES, MediaService, MediaUpload } from './media.service';

@Controller('admin')
@Roles('admin')
class MediaUploadController {
  constructor(private readonly media: MediaService) {}
  @Post('items/:id/photo')
  @ProofUploadRoute()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 0 },
    }),
  )
  photo(
    @Req() req: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @UploadedFile() file: MediaUpload | undefined,
  ) {
    return this.media.upload(req.auth, 'items', file, id);
  }
  @Post('settings/qris-image')
  @ProofUploadRoute()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_MEDIA_BYTES, files: 1, fields: 0 },
    }),
  )
  qris(@Req() req: AuthRequest, @UploadedFile() file: MediaUpload | undefined) {
    return this.media.upload(req.auth, 'qris', file);
  }
}
@Controller('media')
@Public()
class MediaController {
  constructor(private readonly media: MediaService) {}
  @Get(':folder/:filename')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async image(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const file = await this.media.download(folder, filename);
    return new StreamableFile(file.stream, { type: file.mime });
  }
}
@Module({
  imports: [AuthModule, PrismaModule, InventoryModule, SettingsModule],
  controllers: [MediaController, MediaUploadController],
  providers: [MediaService],
})
export class MediaModule {}
