import { Type } from 'class-transformer';
import { IsDefined, IsString, Length, ValidateNested } from 'class-validator';
class PushKeysDto {
  @IsString() @Length(87, 87) p256dh!: string;
  @IsString() @Length(22, 22) auth!: string;
}
export class SubscribeDto {
  @IsString() @Length(1, 2048) endpoint!: string;
  @IsDefined() @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}
export class UnsubscribeDto {
  @IsString() @Length(1, 2048) endpoint!: string;
}
