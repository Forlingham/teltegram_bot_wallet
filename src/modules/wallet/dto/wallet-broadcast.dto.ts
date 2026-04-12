import { IsString } from 'class-validator';

export class WalletBroadcastDto {
  @IsString()
  hex!: string;
}