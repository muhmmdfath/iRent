import { Equals, IsString, Length, ValidateIf } from 'class-validator';
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
