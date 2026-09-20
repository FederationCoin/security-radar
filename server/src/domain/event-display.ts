import type {
  BipArrivedEventDto,
  DependencyVulnEventDto,
  DistantFeedEventDto,
  MissingDepScanEventDto,
  MissingOrgRepoEventDto,
  MissingScanContextEventDto,
  StaleUpstreamEventDto,
  UpstreamMainlineEventDto,
} from './types';

export type EventDisplayFields = {
  headline: string;
  blurb: string;
  sourceUrl?: string;
};

type WithoutDisplay<T> = Omit<T, 'headline' | 'blurb' | 'sourceUrl'>;

export type EventForDisplay =
  | WithoutDisplay<DependencyVulnEventDto>
  | WithoutDisplay<MissingScanContextEventDto>
  | WithoutDisplay<MissingOrgRepoEventDto>
  | WithoutDisplay<MissingDepScanEventDto>
  | WithoutDisplay<UpstreamMainlineEventDto>
  | WithoutDisplay<BipArrivedEventDto>
  | WithoutDisplay<StaleUpstreamEventDto>
  | WithoutDisplay<DistantFeedEventDto>;

export function bipMediawikiUrl(number: number): string {
  return `https://github.com/bitcoin/bips/blob/master/bip-${String(number).padStart(4, '0')}.mediawiki`;
}

function githubUrl(ownerName: string): string | undefined {
  const t = ownerName.trim();
  if (!t) {
    return undefined;
  }
  if (/^https?:\/\//i.test(t)) {
    return t;
  }
  return `https://github.com/${t}`;
}

export function displayFor(dto: EventForDisplay): EventDisplayFields {
  switch (dto.type) {
    case 'BipArrivedEvent': {
      const n = dto.bipNumber;
      const title = dto.bipTitle ?? 'Bitcoin Improvement Proposal';
      const headline = n != null ? `BIP ${n} — ${title}` : title;
      const blurb = dto.bipSummary?.trim() || 'A BIP arrived for maintainer review.';
      return n != null ? { headline, blurb, sourceUrl: bipMediawikiUrl(n) } : { headline, blurb };
    }
    case 'DependencyVulnEvent':
      return {
        headline: `${dto.packageIdentity} (${dto.vulnKey})`,
        blurb: dto.present
          ? 'This vulnerability is still present in a tracked scan context.'
          : 'This vulnerability was observed on a tracked scan context.',
        sourceUrl: `https://osv.dev/vulnerability/${encodeURIComponent(dto.vulnKey)}`,
      };
    case 'MissingScanContextEvent': {
      const sourceUrl = githubUrl(dto.githubOwnerName);
      return sourceUrl
        ? {
            headline: dto.githubOwnerName,
            blurb: 'A FederationCoin org repository has no scan context yet.',
            sourceUrl,
          }
        : {
            headline: dto.githubOwnerName,
            blurb: 'A FederationCoin org repository has no scan context yet.',
          };
    }
    case 'MissingOrgRepoEvent': {
      const sourceUrl = githubUrl(dto.missingName);
      return sourceUrl
        ? {
            headline: dto.missingName,
            blurb: 'A scan context names a repository that is missing from the org.',
            sourceUrl,
          }
        : {
            headline: dto.missingName,
            blurb: 'A scan context names a repository that is missing from the org.',
          };
    }
    case 'MissingDepScanEvent':
      return {
        headline: 'Missing dependency scan',
        blurb: 'A tracked repository has no merge-ingest dependency scan yet.',
      };
    case 'UpstreamMainlineEvent':
      return {
        headline: dto.title,
        blurb: `Upstream mainline moved to ${dto.commit.slice(0, 12)}.`,
      };
    case 'StaleUpstreamEvent':
      return {
        headline: 'Stale upstream',
        blurb: 'An upstream we follow has gone quiet.',
      };
    case 'DistantFeedEvent': {
      const blurb = dto.summary?.trim() || 'A distant feed item arrived.';
      const sourceUrl = /^https?:\/\//i.test(dto.sourceNativeId) ? dto.sourceNativeId : undefined;
      return sourceUrl ? { headline: dto.title, blurb, sourceUrl } : { headline: dto.title, blurb };
    }
  }
}

export function withEventDisplay<T extends EventForDisplay>(dto: T): T & EventDisplayFields {
  return { ...dto, ...displayFor(dto) };
}

export function honorNotesFromFlags(honor?: boolean, implement?: boolean): string | undefined {
  const bits: string[] = [];
  if (honor) {
    bits.push('We honor this BIP.');
  }
  if (implement) {
    bits.push('We implement this BIP on FederationCoin.');
  }
  return bits.length ? bits.join(' ') : undefined;
}
