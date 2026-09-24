import type { ChainId } from './constants';

export type CommandKind =
  | 'acceptTask'
  | 'completeTask'
  | 'reviewBip'
  | 'ackDistantFeed'
  | 'createScanContext'
  | 'recordHumanAssessment'
  | 'recordNoForkAssessment'
  | 'recordSoftForkAssessment'
  | 'recordHardForkAssessment'
  | 'listUnackedDistant';

export type SigningEnvelope = {
  messageVersion: number;
  chain: ChainId;
  wallet: string;
  payloadHash: string;
  signature: string;
  signingBlockHash: string;
  signingBlockHeight: number;
  issuedAt: string;
};

export type RadarErrorCode =
  | 'missingChain'
  | 'unknownChain'
  | 'chainMismatch'
  | 'badEnvelope'
  | 'badWallet'
  | 'notMaintainer'
  | 'commandKindMismatch'
  | 'payloadHashMismatch'
  | 'badSignature'
  | 'tipMismatch'
  | 'unknownField'
  | 'duplicateEnvelope'
  | 'notFound'
  | 'rateLimited'
  | 'notReady'
  | 'notImplemented';

export type ProblemBody = {
  type: string;
  title: string;
  status: number;
  code: RadarErrorCode;
  detail?: string;
};

export class RadarProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: RadarErrorCode,
    readonly title: string,
    readonly detail?: string,
  ) {
    super(title);
    this.name = 'RadarProblem';
  }

  toBody(): ProblemBody {
    return {
      type: `https://radar-api.federationcoin.org/problems/${this.code}`,
      title: this.title,
      status: this.status,
      code: this.code,
      ...(this.detail ? { detail: this.detail } : {}),
    };
  }
}

export type AcceptTask = { taskId: string };
export type CompleteTask = { taskId: string };
export type ReviewBip = {
  bipId: string;
  understanding: string;
  applicability: string;
  honor?: boolean;
  implement?: boolean;
};
export type AckDistantFeed = { eventId: string };
export type CreateScanContext = { name: string; githubOwner: string; githubName: string };
export type RecordHumanAssessment = { eventId: string; writeup: string };
export type RecordNoForkAssessment = { eventId: string; writeup: string };
export type RecordSoftForkAssessment = { eventId: string; writeup: string };
export type RecordHardForkAssessment = { eventId: string; writeup: string };

export type ScanContextRow = { id: string; name: string; createdAt: string };
export type GitHubRepositoryRow = { id: string; owner: string; name: string };
export type UpstreamRow = { id: string; name: string; mainline: string };
export type MaintainerRow = { id: string; p2wpkh: string };
export type BipRow = {
  id: string;
  number: number;
  title: string;
  summary: string;
  whatItDoes?: string;
  howItHitsUs?: string;
  honorNotes?: string;
  ethosNotes?: string;
};
export type TaskRow = {
  id: string;
  title: string;
  createdAt: string;
  completedAt?: string;
  eventId?: string;
};
export type HourlyScanRunRow = { id: string; createdAt: string };
export type MergeIngestRunRow = {
  id: string;
  scanContextId: string;
  githubRunId: string;
  createdAt: string;
};
export type QuantumMilestone = { id: string; at: string; label: string };
export type QuantumClockPublic = { id: string; summary: string; milestones: QuantumMilestone[] };

export type EventDisplay = {
  headline: string;
  blurb: string;
  sourceUrl?: string;
};

export type DependencyVulnEventDto = {
  type: 'DependencyVulnEvent';
  id: string;
  createdAt: string;
  scanContextId: string;
  packageIdentity: string;
  vulnKey: string;
  present: boolean;
  taskComplete: boolean;
  buckets: string[];
} & EventDisplay;
export type MissingScanContextEventDto = {
  type: 'MissingScanContextEvent';
  id: string;
  createdAt: string;
  githubOwnerName: string;
  present: boolean;
  buckets: string[];
} & EventDisplay;
export type MissingOrgRepoEventDto = {
  type: 'MissingOrgRepoEvent';
  id: string;
  createdAt: string;
  scanContextId: string;
  missingName: string;
  present: boolean;
  buckets: string[];
} & EventDisplay;
export type MissingDepScanEventDto = {
  type: 'MissingDepScanEvent';
  id: string;
  createdAt: string;
  scanContextId: string;
  buckets: string[];
} & EventDisplay;
export type UpstreamMainlineEventDto = {
  type: 'UpstreamMainlineEvent';
  id: string;
  createdAt: string;
  scanContextId: string;
  upstreamId: string;
  commit: string;
  title: string;
  buckets: string[];
} & EventDisplay;
export type BipArrivedEventDto = {
  type: 'BipArrivedEvent';
  id: string;
  createdAt: string;
  bipId: string;
  bipNumber?: number;
  bipTitle?: string;
  bipSummary?: string;
  buckets: string[];
} & EventDisplay;
export type StaleUpstreamEventDto = {
  type: 'StaleUpstreamEvent';
  id: string;
  createdAt: string;
  upstreamId: string;
  buckets: string[];
} & EventDisplay;
export type DistantFeedEventDto = {
  type: 'DistantFeedEvent';
  id: string;
  createdAt: string;
  feedSourceId: string;
  sourceNativeId: string;
  title: string;
  summary: string;
  acked: boolean;
  buckets: string[];
} & EventDisplay;

export type PublicEventDto =
  | DependencyVulnEventDto
  | MissingScanContextEventDto
  | MissingOrgRepoEventDto
  | MissingDepScanEventDto
  | UpstreamMainlineEventDto
  | BipArrivedEventDto
  | StaleUpstreamEventDto
  | DistantFeedEventDto;

export type EventPage = { items: PublicEventDto[]; cursor?: string };
export type BipPage = { items: BipRow[] };
export type TaskPage = { items: Array<{ id: string; title: string; complete: boolean; accepted: boolean; eventId?: string }> };
