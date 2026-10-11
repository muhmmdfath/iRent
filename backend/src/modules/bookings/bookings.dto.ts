import { PageDto } from '../inventory/inventory.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsString,
  Length,
  ValidateIf,
  IsIn,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { QuoteDto } from '../pricing/pricing.dto';

export const TERMS_VERSION = 'irent-phase1-v1';

export class CreateBookingDto extends QuoteDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(5, 1000)
  deliveryAddress?: string;

  @Equals(TERMS_VERSION) termsVersion!: string;
  @Equals(true) agreeTerms!: boolean;
  @Equals(true) prepareIdentity!: boolean;
  @Equals(true) understandPayment!: boolean;
  @Equals(true) agreeOperatingHours!: boolean;
}

export class BookingListDto extends PageDto {
  @ApiPropertyOptional({
    description: 'Filter pelanggan untuk daftar admin',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
  @ApiPropertyOptional({
    description: 'Pencarian kode booking atau nama pelanggan (admin)',
    minLength: 1,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;
  @ApiPropertyOptional({
    enum: ['oldest', 'newest', 'deadline'],
    default: 'oldest',
  })
  @IsIn(['oldest', 'newest', 'deadline'])
  sort: 'oldest' | 'newest' | 'deadline' = 'oldest';
  @ApiPropertyOptional({
    enum: [
      'menunggu_pembayaran',
      'menunggu_konfirmasi',
      'dikonfirmasi',
      'berjalan',
      'selesai',
      'kedaluwarsa',
      'ditolak',
      'dibatalkan',
    ],
  })
  @IsOptional()
  @IsIn([
    'menunggu_pembayaran',
    'menunggu_konfirmasi',
    'dikonfirmasi',
    'berjalan',
    'selesai',
    'kedaluwarsa',
    'ditolak',
    'dibatalkan',
  ])
  status?: string;
}
