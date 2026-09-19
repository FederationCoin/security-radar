import type { ChainId } from '../../domain/constants';
import type { ChainTip, ChainView } from '../../ports/chain-view';

export class MemoryChainView implements ChainView {
  constructor(
    readonly state: ChainTip = {
      height: 10,
      hash: 'ab'.repeat(32),
    },
  ) {}

  async getTip(_chain: ChainId): Promise<ChainTip> {
    return { height: this.state.height, hash: this.state.hash };
  }
}
