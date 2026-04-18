import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum RedPacketTypeDto {
  EQUAL = 'EQUAL',
  RANDOM = 'RANDOM',
}

export class RedpacketCreateDto {
  @IsEnum(RedPacketTypeDto)
  type!: RedPacketTypeDto;

  @IsString()
  totalAmount!: string;

  @IsInt()
  @Min(1)
  count!: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  coverId?: number;

  @IsString()
  txid!: string;

  @IsOptional()
  @IsString()
  dapTxid?: string;

  @IsOptional()
  @IsString()
  packetHash?: string;

  @IsOptional()
  @IsString()
  senderAddress?: string;

  @IsString()
  feeReserve!: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  expireSeconds?: number;
}
