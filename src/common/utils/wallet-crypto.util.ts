import * as bip39 from 'bip39';
import { HDKey } from '@scure/bip32';
import { bech32 } from '@scure/base';
import * as bitcoin from 'bitcoinjs-lib';
import { getScashNetwork } from '../../config/scash.networks';

export function deriveAddressFromMnemonic(
  mnemonic: string,
  nodeEnv: string,
): string {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = HDKey.fromMasterSeed(seed);
  const child = root.derive("m/84'/0'/0'/0/0");
  const pubkey: Uint8Array = child.publicKey as Uint8Array;
  const pubkeyBuffer = Buffer.from(pubkey);
  const hash160 = bitcoin.crypto.hash160(pubkeyBuffer);
  const words = bech32.toWords(hash160);
  words.unshift(0);
  const network = getScashNetwork(nodeEnv);
  return bech32.encode(network.bech32, words);
}