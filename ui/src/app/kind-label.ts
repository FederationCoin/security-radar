export function kindLabel(type: string): string {
  switch (type) {
    case 'BipArrivedEvent':
      return 'BIP arrived';
    case 'DistantFeedEvent':
      return 'Distant feed';
    case 'DependencyVulnEvent':
      return 'Dependency vulnerability';
    case 'MissingScanContextEvent':
      return 'Repo without a scan context';
    case 'MissingOrgRepoEvent':
      return 'Tracked repo left the org';
    case 'MissingDepScanEvent':
      return 'Missing dependency scan';
    case 'UpstreamMainlineEvent':
      return 'Upstream mainline';
    case 'StaleUpstreamEvent':
      return 'Stale upstream';
    default:
      return 'Intel';
  }
}

export type CountRow = { label: string; count: number };

export function countsByKind(events: Array<{ type: string }>): CountRow[] {
  const map = new Map<string, number>();
  for (const e of events) {
    const label = kindLabel(e.type);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return [...map.entries()].map(([label, count]) => ({ label, count }));
}

export function taskCounts(tasks: Array<{ complete: boolean }>): CountRow[] {
  if (tasks.length === 0) {
    return [];
  }
  let open = 0;
  let done = 0;
  for (const t of tasks) {
    if (t.complete) {
      done += 1;
    } else {
      open += 1;
    }
  }
  return [
    { label: 'Open', count: open },
    { label: 'Done', count: done },
  ];
}

export function bipMediawikiUrl(number: number): string {
  return `https://github.com/bitcoin/bips/blob/master/bip-${String(number).padStart(4, '0')}.mediawiki`;
}
