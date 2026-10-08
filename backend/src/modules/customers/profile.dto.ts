import {
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class ProfileDto {
  @IsString() @Length(1, 150) fullName!: string;
  @IsString() @Length(1, 1000) address!: string;
  @IsString() @Length(1, 40) phoneActive!: string;
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^[0-9]{16}$/)
  nik?: string;
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(40)
  phoneAlt?: string | null;
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(100)
  instagram?: string | null;
  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(254)
  emailContact?: string | null;
}
