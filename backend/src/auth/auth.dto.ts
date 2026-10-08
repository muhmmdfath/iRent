import {
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString() @Length(1, 100) name!: string;
  @ValidateIf((_, v: unknown) => v !== undefined)
  @IsString()
  @Length(1, 254)
  email?: string;
  @ValidateIf((_, v: unknown) => v !== undefined)
  @IsString()
  @Length(1, 40)
  phone?: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
export class LoginDto {
  @IsString() @Length(1, 254) identity!: string;
  @IsString() @Length(1, 128) password!: string;
}
export class ResetPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}
