import { describe, expect, it } from 'vitest';
import { bipMediawikiUrl, countsByKind, kindLabel, taskCounts } from './kind-label';

describe('kindLabel', () => {
  it('maps every public event type and an unknown type', () => {
    expect(kindLabel('BipArrivedEvent')).toBe('BIP arrived');
    expect(kindLabel('DistantFeedEvent')).toBe('Distant feed');
    expect(kindLabel('DependencyVulnEvent')).toBe('Dependency vulnerability');
    expect(kindLabel('MissingScanContextEvent')).toBe('Repo without a scan context');
    expect(kindLabel('MissingOrgRepoEvent')).toBe('Tracked repo left the org');
    expect(kindLabel('MissingDepScanEvent')).toBe('Missing dependency scan');
    expect(kindLabel('UpstreamMainlineEvent')).toBe('Upstream mainline');
    expect(kindLabel('StaleUpstreamEvent')).toBe('Stale upstream');
    expect(kindLabel('NotARealType')).toBe('Intel');
  });
});

describe('countsByKind', () => {
  it('is empty when there are no events', () => {
    expect(countsByKind([])).toEqual([]);
  });

  it('groups by kind label', () => {
    expect(
      countsByKind([
        { type: 'BipArrivedEvent' },
        { type: 'BipArrivedEvent' },
        { type: 'DistantFeedEvent' },
      ]),
    ).toEqual([
      { label: 'BIP arrived', count: 2 },
      { label: 'Distant feed', count: 1 },
    ]);
  });
});

describe('taskCounts', () => {
  it('is empty when there are no tasks', () => {
    expect(taskCounts([])).toEqual([]);
  });

  it('splits open and done', () => {
    expect(taskCounts([{ complete: false }, { complete: true }, { complete: false }])).toEqual([
      { label: 'Open', count: 2 },
      { label: 'Done', count: 1 },
    ]);
  });
});

describe('bipMediawikiUrl', () => {
  it('pads to four digits', () => {
    expect(bipMediawikiUrl(9)).toContain('bip-0009');
  });
});
