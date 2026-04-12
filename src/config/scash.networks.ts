export const SCASH_NETWORKS = {
  development: {
    messagePrefix: '\x18Scash Signed Message:\n',
    bech32: 'bcrt',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x3c,
    scriptHash: 0x7d,
    wif: 0x80,
  },
  production: {
    messagePrefix: '\x18Scash Signed Message:\n',
    bech32: 'scash',
    bip32: { public: 0x0488b21e, private: 0x0488ade4 },
    pubKeyHash: 0x3c,
    scriptHash: 0x7d,
    wif: 0x80,
  },
} as const;

export type ScashNetwork = (typeof SCASH_NETWORKS)[keyof typeof SCASH_NETWORKS];

export function getScashNetwork(nodeEnv: string): ScashNetwork {
  if (nodeEnv === 'production') return SCASH_NETWORKS.production;
  return SCASH_NETWORKS.development;
}