import { bech32 } from '@scure/base'
import * as bitcoin from 'bitcoinjs-lib'
import { deflate, inflate } from 'pako'
import { Buffer } from 'buffer'

const PROTOCOLS = {
  RAW: {
    magic: Buffer.from([0xAF, 0xAF, 0xAF, 0xAF]),
    description: '原文模式 - 直接存储UTF8文本',
  },
  ZIP: {
    magic: Buffer.from([0xAC, 0xAC, 0xAC, 0xAC]),
    description: '压缩模式 - 使用Deflate算法压缩',
  },
}

const CHUNK_PAYLOAD_SIZE = 28 // 32 - 4

function decodeScashAddressToHash(address: string, networkBech32: string): Buffer | null {
  try {
    const prefix = networkBech32 || 'scash'
    if (!address || !address.startsWith(prefix)) return null
    const decoded = bech32.decode(address)
    if (decoded.prefix !== prefix) return null
    const data = bech32.fromWords(decoded.words.slice(1))
    return Buffer.from(data)
  } catch {
    return null
  }
}

function preparePayload(text: string, debug = false) {
  const rawBuffer = Buffer.from(text, 'utf8')
  let finalPayload: Buffer = rawBuffer
  let selectedProtocol = PROTOCOLS.RAW
  let mode = 'RAW'

  try {
    const compressed = deflate(rawBuffer)
    const compressedBuffer = Buffer.from(compressed)
    if (compressedBuffer.length < rawBuffer.length) {
      finalPayload = compressedBuffer
      selectedProtocol = PROTOCOLS.ZIP
      mode = 'ZIP'
      if (debug) {
        console.log(`[Scash-DAP] 压缩生效: ${rawBuffer.length} -> ${compressedBuffer.length} bytes`)
      }
    } else if (debug) {
      console.log('[Scash-DAP] 保持原文: 压缩未减小体积')
    }
  } catch (e) {
    console.warn('压缩异常，回退到原文模式', e)
  }

  return { payload: finalPayload, protocol: selectedProtocol, mode }
}

export interface DapCost {
  mode: string
  payloadSize: number
  chunkCount: number
  totalSats: number
  originalSize: number
}

export interface DapOutput {
  address: string
  value: number
}

export interface ScashNetworkLike {
  bech32: string
  [key: string]: any
}

export function estimateDapCost(text: string, debug = false): DapCost {
  const { payload, mode } = preparePayload(text, debug)
  const chunkCount = Math.ceil(payload.length / CHUNK_PAYLOAD_SIZE)
  return {
    mode,
    payloadSize: payload.length,
    chunkCount,
    totalSats: chunkCount * 546,
    originalSize: Buffer.byteLength(text, 'utf8'),
  }
}

export function createDapOutputs(text: string, network: ScashNetworkLike, debug = false): DapOutput[] {
  const { payload: finalPayload, protocol: selectedProtocol } = preparePayload(text, debug)
  const selectedMagic = selectedProtocol.magic
  const outputs: DapOutput[] = []

  for (let i = 0; i < finalPayload.length; i += CHUNK_PAYLOAD_SIZE) {
    const chunk = Buffer.alloc(32)
    selectedMagic.copy(chunk, 0)

    const end = Math.min(i + CHUNK_PAYLOAD_SIZE, finalPayload.length)
    finalPayload.subarray(i, end).copy(chunk, 4)

    const payment = bitcoin.payments.p2wsh({
      hash: chunk,
      network: network as any,
    })

    outputs.push({
      address: payment.address!,
      value: 546,
    })
  }
  return outputs
}

export function getDapProtocolType(address: string, networkBech32: string): string | null {
  const hash = decodeScashAddressToHash(address, networkBech32)
  if (!hash) return null
  const hex = hash.toString('hex')
  for (const [key, protocol] of Object.entries(PROTOCOLS)) {
    if (hex.startsWith(protocol.magic.toString('hex'))) {
      return key
    }
  }
  return null
}

export function isDapAddress(address: string, networkBech32: string): boolean {
  return getDapProtocolType(address, networkBech32) !== null
}

export function parseDapTransaction(
  inputs: Array<string | { address?: string; scriptPubKey?: { address?: string; addresses?: string[] } }>,
  networkBech32: string,
): string {
  const MAGIC_HEX_RAW = PROTOCOLS.RAW.magic.toString('hex')
  const MAGIC_HEX_ZIP = PROTOCOLS.ZIP.magic.toString('hex')
  let fullBuffer = Buffer.alloc(0)
  let isCompressed = false

  const addresses: string[] = []
  for (const item of inputs) {
    if (typeof item === 'string') {
      addresses.push(item)
    } else if (item && typeof item === 'object') {
      if (item.address) {
        addresses.push(item.address)
      } else if (item.scriptPubKey) {
        const addr = item.scriptPubKey.address || (item.scriptPubKey.addresses ? item.scriptPubKey.addresses[0] : null)
        if (addr) addresses.push(addr)
      }
    }
  }

  for (const address of addresses) {
    if (!address) continue
    const hash = decodeScashAddressToHash(address, networkBech32)
    if (hash && hash.length === 32) {
      const hex = hash.toString('hex')
      if (hex.startsWith(MAGIC_HEX_RAW)) {
        fullBuffer = Buffer.concat([fullBuffer, hash.subarray(4)])
      } else if (hex.startsWith(MAGIC_HEX_ZIP)) {
        isCompressed = true
        fullBuffer = Buffer.concat([fullBuffer, hash.subarray(4)])
      }
    }
  }

  // Trim trailing zeros
  let clean = fullBuffer
  while (clean.length > 0 && clean[clean.length - 1] === 0) {
    clean = clean.subarray(0, clean.length - 1)
  }

  if (isCompressed) {
    try {
      const inflated = inflate(clean)
      return Buffer.from(inflated).toString('utf8')
    } catch (e) {
      console.warn('解压失败', e)
      return ''
    }
  }

  return clean.toString('utf8')
}
