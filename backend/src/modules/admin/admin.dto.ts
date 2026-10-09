import { IsIn, IsString, IsUUID, ValidateIf } from 'class-validator';
import { PageDto } from '../inventory/inventory.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class TasksDto extends PageDto {
  @ApiPropertyOptional({
    type: String,
    default: 'all',
    enum: [
      'all',
      'payment',
      'return',
      'extension_quote',
      'refund',
      'preparation',
      'handover',
    ],
  })
  @IsIn([
    'all',
    'payment',
    'return',
    'extension_quote',
    'refund',
    'preparation',
    'handover',
  ])
  kind: string = 'all';
}
export class RefundListDto extends PageDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn(['diajukan', 'disetujui', 'ditolak', 'sudah_dikembalikan'])
  status?: 'diajukan' | 'disetujui' | 'ditolak' | 'sudah_dikembalikan';
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  bookingId?: string;
}
export class ExtensionListDto extends PageDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsIn([
    'draft_quote',
    'menunggu_pembayaran',
    'menunggu_konfirmasi',
    'disetujui',
    'ditolak',
    'kedaluwarsa',
    'dibatalkan',
  ])
  status?:
    | 'draft_quote'
    | 'menunggu_pembayaran'
    | 'menunggu_konfirmasi'
    | 'disetujui'
    | 'ditolak'
    | 'kedaluwarsa'
    | 'dibatalkan';
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  bookingId?: string;
}
export class CalendarDto extends PageDto {
  @IsString() startAt!: string;
  @IsString() endAt!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  itemId?: string;
}
