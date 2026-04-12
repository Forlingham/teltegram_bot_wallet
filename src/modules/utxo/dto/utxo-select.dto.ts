import { IsNumber, IsString, Min } from 'class-validator';

export class UtxoSelectDto {
  @IsString()
  address!: string;

  @IsString()
  amount!: string;

  @IsNumber()
  @Min(1)
  feeRate!: number;
}
