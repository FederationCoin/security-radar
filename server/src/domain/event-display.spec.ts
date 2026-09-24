import { describe, expect, it } from 'vitest';
import {
  bipMediawikiUrl,
  displayFor,
  honorNotesFromFlags,
  withEventDisplay,
} from './event-display';

const buckets = ['public'];

describe('event display', () => {
  it('pads BIP mediawiki URLs to four digits', () => {
    expect(bipMediawikiUrl(9)).toBe(
      'https://github.com/bitcoin/bips/blob/master/bip-0009.mediawiki',
    );
    expect(bipMediawikiUrl(341)).toBe(
      'https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki',
    );
  });

  it('headlines a BIP with number, title, summary, and mediawiki link', () => {
    const d = displayFor({
      type: 'BipArrivedEvent',
      id: 'e',
      createdAt: 't',
      bipId: 'b',
      bipNumber: 341,
      bipTitle: 'Taproot',
      bipSummary: 'Schnorr and MAST.',
      buckets,
    });
    expect(d.headline).toBe('BIP 341 — Taproot');
    expect(d.blurb).toBe('Schnorr and MAST.');
    expect(d.sourceUrl).toContain('bip-0341');
  });

  it('falls back when a BIP row has not been joined', () => {
    const d = displayFor({
      type: 'BipArrivedEvent',
      id: 'e',
      createdAt: 't',
      bipId: 'b',
      buckets,
    });
    expect(d.headline).toBe('Bitcoin Improvement Proposal');
    expect(d.blurb).toContain('maintainer review');
    expect(d.sourceUrl).toBeUndefined();
  });

  it('headlines a package and OSV key', () => {
    const d = displayFor({
      type: 'DependencyVulnEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      packageIdentity: 'lodash',
      vulnKey: 'GHSA-xx',
      present: true,
      taskComplete: false,
      buckets,
    });
    expect(d.headline).toBe('lodash (GHSA-xx)');
    expect(d.blurb).toContain('still present');
    expect(d.sourceUrl).toBe('https://osv.dev/vulnerability/GHSA-xx');
  });

  it('blurbs a vuln that is no longer present', () => {
    const d = displayFor({
      type: 'DependencyVulnEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      packageIdentity: 'lodash',
      vulnKey: 'CVE-1',
      present: false,
      taskComplete: true,
      buckets,
    });
    expect(d.blurb).toContain('was observed');
  });

  it('links a missing scan context to GitHub', () => {
    const d = displayFor({
      type: 'MissingScanContextEvent',
      id: 'e',
      createdAt: 't',
      githubOwnerName: 'FederationCoin/cpu-miner',
      present: true,
      buckets,
    });
    expect(d.headline).toBe('FederationCoin/cpu-miner');
    expect(d.sourceUrl).toBe('https://github.com/FederationCoin/cpu-miner');
  });

  it('omits a GitHub URL when the owner name is empty', () => {
    const d = displayFor({
      type: 'MissingScanContextEvent',
      id: 'e',
      createdAt: 't',
      githubOwnerName: '  ',
      present: true,
      buckets,
    });
    expect(d.sourceUrl).toBeUndefined();
  });

  it('keeps an already-absolute GitHub URL', () => {
    const d = displayFor({
      type: 'MissingScanContextEvent',
      id: 'e',
      createdAt: 't',
      githubOwnerName: 'https://github.com/FederationCoin/x',
      present: true,
      buckets,
    });
    expect(d.sourceUrl).toBe('https://github.com/FederationCoin/x');
  });

  it('headlines a missing org repo', () => {
    const d = displayFor({
      type: 'MissingOrgRepoEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      missingName: 'FederationCoin/gone',
      present: true,
      buckets,
    });
    expect(d.headline).toBe('FederationCoin/gone');
    expect(d.sourceUrl).toBe('https://github.com/FederationCoin/gone');
  });

  it('omits a URL for an empty missing org name', () => {
    const d = displayFor({
      type: 'MissingOrgRepoEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      missingName: '',
      present: true,
      buckets,
    });
    expect(d.sourceUrl).toBeUndefined();
  });

  it('headlines a missing dependency scan without a source', () => {
    const d = displayFor({
      type: 'MissingDepScanEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      buckets,
    });
    expect(d.headline).toBe('Missing dependency scan');
    expect(d.sourceUrl).toBeUndefined();
  });

  it('headlines upstream mainline with a short commit', () => {
    const d = displayFor({
      type: 'UpstreamMainlineEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      upstreamId: 'u',
      commit: 'abcdef1234567890',
      title: 'Merge pull request',
      buckets,
    });
    expect(d.headline).toBe('Merge pull request');
    expect(d.blurb).toBe('Upstream mainline moved to abcdef123456.');
  });

  it('headlines a stale upstream', () => {
    const d = displayFor({
      type: 'StaleUpstreamEvent',
      id: 'e',
      createdAt: 't',
      upstreamId: 'u',
      buckets,
    });
    expect(d.headline).toBe('Stale upstream');
  });

  it('uses a distant title and HTTP native id as source', () => {
    const d = displayFor({
      type: 'DistantFeedEvent',
      id: 'e',
      createdAt: 't',
      feedSourceId: 'f',
      sourceNativeId: 'https://example.invalid/item',
      title: 'Feed item',
      summary: 'Body.',
      acked: false,
      buckets,
    });
    expect(d.headline).toBe('Feed item');
    expect(d.blurb).toBe('Body.');
    expect(d.sourceUrl).toBe('https://example.invalid/item');
  });

  it('falls back when a distant summary is empty and native id is not a URL', () => {
    const d = displayFor({
      type: 'DistantFeedEvent',
      id: 'e',
      createdAt: 't',
      feedSourceId: 'f',
      sourceNativeId: 'abc',
      title: 'Feed item',
      summary: '  ',
      acked: false,
      buckets,
    });
    expect(d.blurb).toContain('distant feed');
    expect(d.sourceUrl).toBeUndefined();
  });

  it('fills headline onto a DTO', () => {
    const out = withEventDisplay({
      type: 'MissingDepScanEvent',
      id: 'e',
      createdAt: 't',
      scanContextId: 's',
      buckets,
    });
    expect(out.headline).toBe('Missing dependency scan');
    expect(out.blurb.length).toBeGreaterThan(0);
  });
});

describe('honorNotesFromFlags', () => {
  it('writes two sentences when both flags are set', () => {
    expect(honorNotesFromFlags(true, true)).toBe(
      'We honor this BIP. We implement this BIP on FederationCoin.',
    );
  });

  it('writes honor only', () => {
    expect(honorNotesFromFlags(true, false)).toBe('We honor this BIP.');
  });

  it('writes implement only', () => {
    expect(honorNotesFromFlags(false, true)).toBe('We implement this BIP on FederationCoin.');
  });

  it('is empty when neither flag is set', () => {
    expect(honorNotesFromFlags(false, false)).toBeUndefined();
    expect(honorNotesFromFlags()).toBeUndefined();
  });
});
