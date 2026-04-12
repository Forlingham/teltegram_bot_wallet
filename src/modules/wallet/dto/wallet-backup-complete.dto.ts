import { IsBoolean } from 'class-validator';

export class WalletBackupCompleteDto {
  @IsBoolean()
  backedUp!: boolean;
}
