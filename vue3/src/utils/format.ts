export function satoshiToScashString(sats: bigint): string {
  const sign = sats < 0n ? '-' : ''
  const abs = sats < 0n ? -sats : sats
  const whole = abs / 100000000n
  const frac = (abs % 100000000n).toString().padStart(8, '0')
  return sign + whole.toString() + '.' + frac
}

export function formatBalanceDisplay(sats: bigint): string {
  const str = satoshiToScashString(sats)
  const parts = str.split('.')
  if (parts.length === 2) {
    return parts[0] + '.' + parts[1]
  }
  return str
}

export function formatBalanceSmallDecimal(sats: bigint): { whole: string; decimal: string } {
  const str = satoshiToScashString(sats)
  const parts = str.split('.')
  return {
    whole: parts[0],
    decimal: parts.length === 2 ? '.' + parts[1] : '',
  }
}

export function formatFiat(scashAmount: number, priceUsd: number): string {
  const fiat = scashAmount * priceUsd
  return '≈ $' + fiat.toFixed(2) + ' USD'
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 16) return address
  return address.slice(0, 8) + '...' + address.slice(-6)
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const month = d.getMonth() + 1
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${month}/${day} ${hours}:${minutes}`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}