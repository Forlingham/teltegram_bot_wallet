import { IsInt, IsString, Min } from 'class-validator';

export class CoverPurchaseDto {
  @IsInt()
  @Min(1)
  coverId!: number;

  @IsString()
  txid!: string;
}
