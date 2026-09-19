import { Inject, Injectable } from '@nestjs/common';
import { TokenIntelStore } from '../domain/constants';
import type { IntelStore } from '../ports/intel-store';

@Injectable()
export class OpenTasksForGaps {
  constructor(@Inject(TokenIntelStore) private readonly intel: IntelStore) {}

  async run(): Promise<void> {
    await this.openTaskForUnreviewedBip();
    await this.openTaskForUnackedFeed();
    await this.openTaskForUnassessedUpstream();
    await this.openTaskForPresentVuln();
  }

  async openTaskForUnreviewedBip(): Promise<void> {
    const bips = await this.intel.listBips();
    for (const bip of bips) {
      const eventId = await this.intel.upsertBipArrivedEvent(bip.id);
      if (!(await this.intel.openTaskForEvent(eventId))) {
        await this.intel.insertTask(`Review BIP ${bip.number}`, eventId);
      }
    }
  }

  async openTaskForUnackedFeed(): Promise<void> {
    const unacked = await this.intel.listUnackedDistant();
    for (const ev of unacked) {
      if (!(await this.intel.openTaskForEvent(ev.id))) {
        await this.intel.insertTask(`Ack distant feed ${ev.sourceNativeId}`, ev.id);
      }
    }
  }

  async openTaskForUnassessedUpstream(): Promise<void> {
    const ids = await this.intel.listUpstreamMainlineEventIds();
    for (const id of ids) {
      if (await this.intel.hasForkAssessment(id)) {
        continue;
      }
      if (!(await this.intel.openTaskForEvent(id))) {
        await this.intel.insertTask('Assess upstream mainline event', id);
      }
    }
  }

  async openTaskForPresentVuln(): Promise<void> {
    const ids = await this.intel.listDependencyVulnEventIds();
    for (const id of ids) {
      if (!(await this.intel.depVulnIsPresent(id))) {
        continue;
      }
      if (await this.intel.openTaskForEvent(id)) {
        continue;
      }
      await this.intel.insertTask('Present dependency vuln', id);
    }
  }
}
