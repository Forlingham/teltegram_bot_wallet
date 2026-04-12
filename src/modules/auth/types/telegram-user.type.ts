export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  allows_write_to_pm?: boolean;
  photo_url?: string;
}

export interface ParsedTelegramInitData {
  hash: string;
  authDate: number;
  user: TelegramUser;
  startParam?: string;
  queryId?: string;
}
