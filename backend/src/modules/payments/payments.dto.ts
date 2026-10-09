import {
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class UploadProofDto {
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) claimedAmount!: string;
}
export class ReceiptDto {
  @IsString() @Matches(/^[1-9][0-9]{0,18}$/) amount!: string;
  @IsString() @Length(25, 29) occurredAt!: string;
  @IsIn(['qris', 'transfer', 'cash']) method!: 'qris' | 'transfer' | 'cash';
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 150)
  receivingAccountReference?: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 150)
  transactionReference?: string;
  @IsString() @Length(5, 1000) note!: string;
}
export class CorrectReceiptDto extends ReceiptDto {
  @IsString() @Length(5, 1000) reason!: string;
}
export class SettlementReceiptDto extends ReceiptDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  extensionId?: string;
}
export class VerifyProofDto extends ReceiptDto {
  @IsUUID() proofId!: string;
}
export class RejectProofDto {
  @IsString() @Length(5, 1000) reason!: string;
}
export class ReconcileReceiptDto extends ReceiptDto {
  @IsUUID() obligationId!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsUUID()
  proofId?: string;
}
