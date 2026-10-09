import {
  ArrayMaxSize,
  IsArray,
  IsString,
  IsUUID,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExemptionDto } from './operations.dto';

export class VerifyLossDto {
  @IsString() @Length(25, 29) lostAt!: string;
  @IsString() @Length(5, 1000) lossNote!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) compensationAmount!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExemptionDto)
  exemptions?: ExemptionDto[];
}
export class ReplaceUnitDto {
  @IsUUID() itemUnitId!: string;
  @IsString() @Length(5, 1000) reason!: string;
}
