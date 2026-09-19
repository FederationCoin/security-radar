import { Logger } from '@nestjs/common';
import type { ChainId } from '../../domain/constants';
import type { ChainTip, ChainView } from '../../ports/chain-view';
import type { RpcChainSettings } from '../../ports/secret-store';

type RpcOk = { result: unknown; error: null | { message: string } };

export class RpcChainView implements ChainView {
  private readonly log = new Logger(RpcChainView.name);

  constructor(private readonly byChain: Partial<Record<ChainId, RpcChainSettings>>) {}

  private settings(chain: ChainId): RpcChainSettings {
    const s = this.byChain[chain];
    if (!s) {
      throw new Error('chain rpc is not configured');
    }
    return s;
  }

  private async rpc(chain: ChainId, method: string, params: unknown[] = []): Promise<unknown> {
    const s = this.settings(chain);
    let last: unknown;
    for (const host of s.hosts) {
      try {
        const res = await fetch(host, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: 'Basic ' + Buffer.from(`${s.username}:${s.password}`).toString('base64'),
          },
          body: JSON.stringify({ jsonrpc: '1.0', id: 'radar', method, params }),
        });
        const body = (await res.json()) as RpcOk;
        if (body.error) {
          last = body.error.message;
          continue;
        }
        return body.result;
      } catch (e) {
        last = e;
        this.log.warn('node rpc failed; trying next host');
      }
    }
    throw new Error(typeof last === 'string' ? last : 'chain rpc failed');
  }

  async getTip(chain: ChainId): Promise<ChainTip> {
    const info = (await this.rpc(chain, 'getblockchaininfo')) as {
      blocks: number;
      bestblockhash: string;
    };
    return { height: info.blocks, hash: info.bestblockhash };
  }
}
