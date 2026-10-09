import { IsString, Length, ValidateIf } from 'class-validator';
import { PageDto } from '../inventory/inventory.dto';
export class AccountsDto extends PageDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Length(1, 100)
  search?: string;
}
