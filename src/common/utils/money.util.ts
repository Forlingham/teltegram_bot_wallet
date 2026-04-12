const SCASH_DECIMALS = 8;
const SATOSHI_FACTOR = 10n ** BigInt(SCASH_DECIMALS);

export function scashToSatoshi(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error('Invalid SCASH amount format');
  }

  const [wholePart, fractionPart = ''] = normalized.split('.');
  const paddedFraction = (fractionPart + '0'.repeat(SCASH_DECIMALS)).slice(0, SCASH_DECIMALS);
  const whole = BigInt(wholePart);
  const fraction = BigInt(paddedFraction);

  return whole * SATOSHI_FACTOR + fraction;
}

export function satoshiToScash(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  const whole = abs / SATOSHI_FACTOR;
  const fraction = abs % SATOSHI_FACTOR;
  return `${sign}${whole.toString()}.${fraction.toString().padStart(SCASH_DECIMALS, '0')}`;
}
