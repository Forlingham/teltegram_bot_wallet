import ScashDAP = require('scash-dap');
import { getScashNetwork } from '../../config/scash.networks';

export function buildDapOutputs(nodeEnv: string, message: string): {
  outputs: Array<{ address: string; value: number }>;
  totalSats: number;
  chunkCount: number;
} {
  const network = getScashNetwork(nodeEnv);
  const dap = new ScashDAP(network);
  const outputs = dap.createDapOutputs(message) as Array<{ address: string; value: number }>;
  const cost = dap.estimateCost(message) as { totalSats: number; chunkCount: number };
  return {
    outputs,
    totalSats: cost.totalSats,
    chunkCount: cost.chunkCount,
  };
}
