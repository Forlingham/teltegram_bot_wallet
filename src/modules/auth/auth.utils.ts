import { createHash, createHmac, randomBytes } from 'crypto';

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

export function buildTelegramDataCheckString(params: URLSearchParams): string {
  return Array.from(params.entries())
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

export function verifyTelegramHash(dataCheckString: string, hash: string, botToken: string): boolean {
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return calculatedHash === hash;
}
