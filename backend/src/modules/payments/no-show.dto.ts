import { IsString, Length } from 'class-validator';

export class DeliveryFailureDto {
  @IsString() @Length(25, 29) readyAt!: string;
  @IsString() @Length(25, 29) customerFailureAt!: string;
  @IsString() @Length(5, 1000) reason!: string;
}
