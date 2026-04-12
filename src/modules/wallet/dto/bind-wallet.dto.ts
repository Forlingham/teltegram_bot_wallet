import { IsString, Length } from 'class-validator';

export class BindWalletDto {
  @IsString()
  @Length(8, 128)
  address!: string;
}
