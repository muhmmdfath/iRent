import { PageDto } from '../inventory/inventory.dto';
import {
  Equals,
  IsString,
  Length,
  ValidateIf,
  IsIn,
  IsOptional,
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
  @IsIn(['oldest', 'newest', 'deadline']) sort:
    'oldest' | 'newest' | 'deadline' = 'oldest';
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
