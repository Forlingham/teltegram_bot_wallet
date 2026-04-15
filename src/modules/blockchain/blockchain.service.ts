import { Inject, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '@nestjs/config';

interface RpcResponse<T> {
  result: T;
  error: { code: number; message: string } | null;
  id: string;
}

@Injectable()
export class BlockchainService {
  private readonly client: AxiosInstance;
  private requestId = 0;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const baseURL = this.configService.getOrThrow<string>('SCASH_RPC_URL');
    const username = this.configService.getOrThrow<string>('SCASH_RPC_USER');
    const password = this.configService.getOrThrow<string>('SCASH_RPC_PASS');

    this.client = axios.create({
      baseURL,
      auth: {
        username,
        password,
      },
      timeout: 15000,
    });
  }

  async call<T>(method: string, params: unknown[] = []): Promise<T> {
    const id = `rpc-${Date.now()}-${this.requestId++}`;
    let response;
    try {
      response = await this.client.post<RpcResponse<T>>('', {
        jsonrpc: '2.0',
        id,
        method,
        params,
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const rpcError = error.response?.data as { error?: { message?: string } } | undefined;
        const rpcMessage = rpcError?.error?.message;
        const status = error.response?.status;
        if (rpcMessage) {
          throw new Error(`RPC ${method} failed: ${rpcMessage}`);
        }
        throw new Error(`RPC ${method} failed: HTTP ${status ?? 'UNKNOWN'}`);
      }
      throw error;
    }

    if (response.data.error) {
      throw new Error(`RPC ${method} failed: ${response.data.error.message}`);
    }

    return response.data.result;
  }

  async broadcastTransaction(hex: string): Promise<string> {
    return this.call<string>('sendrawtransaction', [hex]);
  }
}
