import type { ChainId } from '../../domain/constants';
import type { ChainTip, ChainView } from '../../ports/chain-view';

export class MemoryChainView implements ChainView {
  readonly headers = new Map<number, string>();

  constructor(
    readonly state: ChainTip = {
      height: 10,
      hash: 'ab'.repeat(32),
    },
  ) {
    this.headers.set(state.height, state.hash);
  }

  async getTip(_chain: ChainId): Promise<ChainTip> {
    return { height: this.state.height, hash: this.state.hash };
  }

  async headerHashAt(_chain: ChainId, height: number): Promise<string | undefined> {
    return this.headers.get(height);
  }
}
