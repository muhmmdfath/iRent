import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
const supplied = (_: unknown, value: unknown) => value !== undefined;
export class PageDto {
  @ApiPropertyOptional({
    type: 'integer',
    default: 1,
    minimum: 1,
    maximum: 1000000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;
  @ApiPropertyOptional({
    type: 'integer',
    default: 50,
    minimum: 1,
    maximum: 100,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 50;
}
export class ItemDto {
  @IsIn(['iphone', 'accessory']) category!: 'iphone' | 'accessory';
  @IsString() @Length(1, 150) name!: string;
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  includes!: string[];
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) price6h!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) price12h!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) price24h!: string;
  @ValidateIf(supplied)
  @ValidateIf((_, v: unknown) => v !== null)
  @IsString()
  photoPath?: string | null;
}
export class ItemPatchDto {
  @ValidateIf(supplied) @IsString() @Length(1, 150) name?: string;
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  includes?: string[];
  @ValidateIf(supplied)
  @IsString()
  @Matches(/^(0|[1-9][0-9]{0,18})$/)
  price6h?: string;
  @ValidateIf(supplied)
  @IsString()
  @Matches(/^(0|[1-9][0-9]{0,18})$/)
  price12h?: string;
  @ValidateIf(supplied)
  @IsString()
  @Matches(/^(0|[1-9][0-9]{0,18})$/)
  price24h?: string;
  @ValidateIf((_, v: unknown) => v !== undefined && v !== null)
  @IsString()
  photoPath?: string | null;
  @ValidateIf(supplied) @IsBoolean() isActive?: boolean;
}
export class UnitsDto {
  @ValidateIf(supplied) @IsInt() @Min(1) @Max(100) quantity?: number;
  @ValidateIf(supplied)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(/^[A-Za-z0-9-]{1,64}$/, { each: true })
  codes?: string[];
}
export class ActiveDto {
  @IsBoolean() isActive!: boolean;
}
export class MaintenanceDto {
  @IsString() @Length(1, 1000) reason!: string;
}
export class ZoneDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name!: string;
  @IsString() @Matches(/^(0|[1-9][0-9]{0,18})$/) fee!: string;
  @ValidateIf(supplied) @IsBoolean() isActive?: boolean;
}
