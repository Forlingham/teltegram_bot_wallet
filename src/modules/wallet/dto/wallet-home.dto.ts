export interface WalletHomeDto {
  hasWallet: boolean;
  address: string | null;
  isWatchOnly: boolean;
  isMnemonicBackedUp: boolean;
  showBackupReminder: boolean;
  avatarUrl?: string | null;
}
