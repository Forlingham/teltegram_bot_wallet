import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import { bech32 } from '@scure/base'
import { sha256 } from '@noble/hashes/sha2'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { hmac } from '@noble/hashes/hmac'
import * as secp from '@noble/secp256k1'
import * as bitcoin from 'bitcoinjs-lib'
import { Buffer } from 'buffer'
import { useNetworkStore } from '@/stores/network'

secp.hashes.sha256 = sha256 as any
secp.hashes.hmacSha256 = ((key: Uint8Array, ...msgs: Uint8Array[]) => {
  return hmac(sha256, key, concatBytes(...msgs))
}) as any

function hexToBytes(hex: string): Uint8Array {
  if (!hex || typeof hex !== 'string') throw new Error('Invalid hex string')
  const parts = hex.match(/.{2}/g)
  if (!parts) throw new Error('Invalid hex string')
  return new Uint8Array(parts.map((b) => parseInt(b, 16)))
}

function bytesToHex(arr: Uint8Array | ArrayBuffer): string {
  return Array.from(new Uint8Array(arr)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0
  for (const arr of arrays) total += arr.length
  const out = new Uint8Array(total)
  let offset = 0
  for (const arr of arrays) {
    out.set(arr, offset)
    offset += arr.length
  }
  return out
}

function getScashNetwork() {
  const store = useNetworkStore()
  return {
    messagePrefix: '\x18Scash Signed Message:\n',
    bech32: store.bech32 || 'bcrt',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: store.pubKeyHash ?? 0x3c,
    scriptHash: store.scriptHash ?? 0x7d,
    wif: 0x80,
  }
}

function toBytes(input: unknown): Uint8Array {
  if (!input) throw new Error('Empty signing result')
  if (input instanceof Uint8Array) return input
  if (Array.isArray(input)) return new Uint8Array(input)
  if (typeof input === 'string') {
    if (/^[0-9a-fA-F]+$/.test(input) && input.length % 2 === 0) {
      return hexToBytes(input)
    }
    return new TextEncoder().encode(input)
  }
  if (typeof (input as any).toCompactRawBytes === 'function') return (input as any).toCompactRawBytes()
  if (typeof (input as any).toRawBytes === 'function') return (input as any).toRawBytes()
  if ((input as any).buffer instanceof ArrayBuffer) return new Uint8Array((input as any).buffer, (input as any).byteOffset || 0, (input as any).byteLength || (input as any).length || 0)
  throw new Error('Unsupported byte type: ' + Object.prototype.toString.call(input))
}

export function useCrypto() {
  function generateMnemonic(): string {
    return bip39.generateMnemonic(128)
  }

  function validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic)
  }

  function deriveAddress(mnemonic: string): string {
    const network = getScashNetwork()
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const root = HDKey.fromMasterSeed(seed)
    const child = root.derive("m/84'/0'/0'/0/0")
    const pubKey = child.publicKey
    if (!pubKey) throw new Error('Cannot derive public key')
    const hash = ripemd160(sha256(pubKey))
    const words = bech32.toWords(hash)
    words.unshift(0)
    return bech32.encode(network.bech32, words)
  }

  function deriveKeyPair(mnemonic: string): { privateKey: Uint8Array; publicKey: Uint8Array } {
    const seed = bip39.mnemonicToSeedSync(mnemonic)
    const root = HDKey.fromMasterSeed(seed)
    const child = root.derive("m/84'/0'/0'/0/0")
    const privateKey = child.privateKey
    const publicKey = child.publicKey
    if (!privateKey || !publicKey) throw new Error('Cannot derive key pair')
    return { privateKey, publicKey }
  }

  async function encryptMnemonic(mnemonic: string, password: string): Promise<{
    ciphertext: string
    salt: string
    iv: string
    authTag: string
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const keyBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256)
    const aesKey = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['encrypt'])

    const encryptedBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv.buffer as ArrayBuffer, tagLength: 128 }, aesKey, new TextEncoder().encode(mnemonic))
    const encryptedBytes = new Uint8Array(encryptedBuf)
    const cipherBytes = encryptedBytes.slice(0, encryptedBytes.length - 16)
    const tagBytes = encryptedBytes.slice(encryptedBytes.length - 16)

    return {
      ciphertext: bytesToHex(cipherBytes),
      salt: bytesToHex(salt),
      iv: bytesToHex(iv),
      authTag: bytesToHex(tagBytes),
    }
  }

  async function decryptMnemonic(backup: {
    encryptedMnemonic?: string
    ciphertext?: string
    salt: string
    iv: string
    authTag?: string
  }, password: string): Promise<string> {
    const saltBytes = hexToBytes(backup.salt) as Uint8Array
    const ivBytes = hexToBytes(backup.iv) as Uint8Array
    const cipherHex = backup.encryptedMnemonic || backup.ciphertext || ''
    const ctBytes = hexToBytes(cipherHex)
    let tagBytes: Uint8Array | null = null
    try {
      if (backup.authTag) tagBytes = hexToBytes(backup.authTag)
    } catch {}

    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
    const keyBits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes as any, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256)
    const aesKey = await crypto.subtle.importKey('raw', keyBits, 'AES-GCM', false, ['decrypt'])

    const candidates: Uint8Array[] = [ctBytes]
    if (tagBytes && tagBytes.length > 0) {
      candidates.push(concatBytes(ctBytes, tagBytes))
      candidates.push(concatBytes(tagBytes, ctBytes))
    }

    for (const candidate of candidates) {
      try {
        const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes as BufferSource, tagLength: 128 }, aesKey, candidate as BufferSource)
        return new TextDecoder().decode(pt)
      } catch {}
    }

    throw new Error('钱包密码错误或数据损坏')
  }

  async function buildTransaction(
    mnemonic: string,
    utxos: { txid: string; vout: number; amount: string }[],
    outputs: { address: string; value: bigint }[],
    feeSat: bigint,
  ): Promise<string> {
    const network = getScashNetwork()
    const myAddress = deriveAddress(mnemonic)
    const { privateKey, publicKey } = deriveKeyPair(mnemonic)

    const psbt = new bitcoin.Psbt({ network: network as any })
    let totalInputSat = 0n
    const outputsTotalSat = outputs.reduce((s, o) => s + o.value, 0n)

    for (const u of utxos) {
      if (!u.txid || typeof u.vout !== 'number' || !u.amount) continue
      const uSat = BigInt(Math.round(parseFloat(u.amount) * 1e8))
      const script = bitcoin.address.toOutputScript(myAddress, network as any)
      psbt.addInput({
        hash: u.txid,
        index: u.vout,
        witnessUtxo: { script, value: uSat as any },
      })
      totalInputSat += uSat
      if (totalInputSat >= outputsTotalSat + feeSat) break
    }

    if (totalInputSat < outputsTotalSat + feeSat) {
      throw new Error('UTXO 余额不足（含手续费）')
    }

    for (const output of outputs) {
      psbt.addOutput({ address: output.address, value: output.value as any })
    }

    const changeSat = totalInputSat - outputsTotalSat - feeSat
    if (changeSat > 0n) {
      psbt.addOutput({ address: myAddress, value: changeSat as any })
    }

    const signer = {
      publicKey: Buffer.from(publicKey),
      sign: async (hash: Buffer) => {
        const sig = await secp.signAsync(new Uint8Array(hash), privateKey)
        return Buffer.from(toBytes(sig))
      },
    }

    for (let i = 0; i < psbt.inputCount; i++) {
      await psbt.signInputAsync(i, signer)
    }

    psbt.finalizeAllInputs()
    return psbt.extractTransaction().toHex()
  }

  async function sha256Hash(data: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
    return bytesToHex(new Uint8Array(buf))
  }

  return {
    generateMnemonic,
    validateMnemonic,
    deriveAddress,
    deriveKeyPair,
    encryptMnemonic,
    decryptMnemonic,
    buildTransaction,
    sha256Hash,
    hexToBytes,
    bytesToHex,
    concatBytes,
    getScashNetwork,
  }
}