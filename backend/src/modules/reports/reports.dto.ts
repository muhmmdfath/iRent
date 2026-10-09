import { IsIn, IsString, Matches } from 'class-validator';
import { PageDto } from '../inventory/inventory.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReportDto extends PageDto {
  @ApiPropertyOptional({ type: String, enum: ['day', 'month'], default: 'day' })
  @IsIn(['day', 'month'])
  kind: 'day' | 'month' = 'day';
  @IsString() @Matches(/^\d{4}-\d{2}(?:-\d{2})?$/) period!: string;
}
