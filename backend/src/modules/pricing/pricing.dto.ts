import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
export class QuoteItemDto {
  @IsUUID() itemId!: string;
  @IsInt() @Min(1) @Max(100) quantity!: number;
}
export class QuoteDto {
  @IsString() @Length(25, 29) startAt!: string;
  @IsInt() @Min(6) @Max(168) durationHours!: number;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items!: QuoteItemDto[];
  @IsIn(['pickup', 'delivery']) deliveryType!: 'pickup' | 'delivery';
  @ValidateIf((_, v: unknown) => v !== undefined)
  @IsUUID()
  deliveryZoneId?: string;
  @IsIn(['dp', 'full']) payOption: 'dp' | 'full' = 'dp';
}
