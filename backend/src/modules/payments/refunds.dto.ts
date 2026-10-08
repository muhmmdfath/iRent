import { IsString, Length, Matches } from 'class-validator';

export class CancelBookingDto {
  @IsString() @Length(5, 1000) reason!: string;
}
export class RefundRecipientDto {
  @IsString() @Length(2, 100) bankName!: string;
  @IsString() @Matches(/^[0-9]{5,34}$/) accountNumber!: string;
  @IsString() @Length(2, 150) accountHolder!: string;
}
export class TransferRefundDto {
  @IsString() @Matches(/^[1-9][0-9]{0,18}$/) amount!: string;
  @IsString() @Length(25, 29) transferredAt!: string;
  @IsString() @Length(1, 150) transactionReference!: string;
  @IsString() @Length(5, 1000) note!: string;
}
