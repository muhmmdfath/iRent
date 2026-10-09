import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsString,
  Length,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class HandoverDto {
  @IsString() @Length(25, 29) pickedUpAt!: string;
  @IsString() @Length(5, 1000) conditionNote!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(5, 1000)
  shopDelayReason?: string;
}
export class ExemptionDto {
  @IsIn(['admin', 'courier']) type!: 'admin' | 'courier';
  @IsString() @Length(25, 29) from!: string;
  @IsString() @Length(25, 29) to!: string;
  @IsString() @Length(5, 1000) reason!: string;
}
export class VerifyReturnDto {
  @IsString() @Length(25, 29) receivedAtStore!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(25, 29)
  receivedByCourierAt?: string;
  @IsIn(['layak', 'maintenance']) condition!: 'layak' | 'maintenance';
  @IsString() @Length(5, 1000) conditionNote!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) damageAmount!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(5, 1000)
  damageNote?: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExemptionDto)
  exemptions?: ExemptionDto[];
}
export class CorrectReturnDto {
  @IsString() @Length(25, 29) receivedAtStore!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(25, 29)
  receivedByCourierAt?: string;
  @IsString() @Length(5, 1000) conditionNote!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) damageAmount!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(5, 1000)
  damageNote?: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ExemptionDto)
  exemptions?: ExemptionDto[];
  @IsString() @Length(5, 1000) reason!: string;
}
