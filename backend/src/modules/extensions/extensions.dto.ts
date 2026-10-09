import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

export class ExtensionSelectionDto {
  @IsUUID() bookingItemId!: string;
  @IsIn([6, 12, 24]) addedHours!: number;
}
export class CreateExtensionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ExtensionSelectionDto)
  items!: ExtensionSelectionDto[];
}
export class QuoteExtensionDto {
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) extraDeliveryQuote!: string;
  @IsString() @Length(5, 1000) note!: string;
}
export class SubmitExtensionDto {
  @IsBoolean() agreeExtraDelivery!: boolean;
  @IsString()
  @Matches(/^(0|[1-9][0-9]{0,18})$/)
  expectedExtraDeliveryQuote!: string;
}
