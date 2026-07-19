import { createHash } from 'node:crypto';
import type { EvidenceItem, RawEvidence, ResearchTask, TimelineEntry } from './contracts.js';

const INJECTION_PATTERNS: Array<[string, RegExp]> = [
  [
    'instruction_override',
    /(?:ignore|disregard) (?:all |any )?(?:previous|prior|system) instructions/i,
  ],
  ['tool_request', /(?:call|invoke|run|execute) (?:the )?(?:tool|shell|command|function)/i],
  ['secret_request', /(?:reveal|print|send|exfiltrate).{0,40}(?:secret|token|api key|credential)/i],
  ['role_impersonation', /(?:system|assistant|developer)\s*:/i],
];

export function normalizeEvidence(
  raw: RawEvidence[],
  task: ResearchTask,
  now = Date.now(),
): EvidenceItem[] {
  const unique = new Map<string, EvidenceItem>();
  const allowed = task.sourcePolicy.allowedDomains?.map((item) => item.toLowerCase());
  const denied = new Set(task.sourcePolicy.deniedDomains?.map((item) => item.toLowerCase()));

  for (const item of raw) {
    const canonicalUrl = item.url ? canonicalizeUrl(item.url) : undefined;
    const hostname = canonicalUrl ? new URL(canonicalUrl).hostname.toLowerCase() : undefined;
    if (hostname && denied.has(hostname)) continue;
    if (
      hostname &&
      allowed &&
      !allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    )
      continue;
    const boundedExcerpt = item.excerpt ? item.excerpt.slice(0, 500) : undefined;
    const normalizedStatement = item.statement.trim().replace(/\s+/g, ' ').slice(0, 2_000);
    const contentHash = hash(
      `${item.resourceId ?? ''}\n${canonicalUrl ?? ''}\n${normalizedStatement}`,
    );
    const dedupeKey = item.resourceId
      ? `${item.sourceType}:${item.resourceId}:${item.revision ?? ''}`
      : contentHash;
    if (unique.has(dedupeKey)) continue;
    const comparisonTime = item.revisedAt ?? item.publishedAt ?? item.eventAt ?? item.retrievedAt;
    const age = now - Date.parse(comparisonTime);
    const injectionSignals = detectPromptInjection(
      `${boundedExcerpt ?? ''}\n${normalizedStatement}`,
    );
    unique.set(dedupeKey, {
      ...item,
      ...(canonicalUrl ? { canonicalUrl } : {}),
      ...(boundedExcerpt ? { excerpt: boundedExcerpt } : {}),
      statement: normalizedStatement,
      evidenceId: `ev_${contentHash.slice(0, 24)}`,
      contentHash,
      relationships: [],
      injectionSignals,
      freshness: Number.isFinite(age)
        ? age <= task.sourcePolicy.freshnessMs
          ? 'fresh'
          : 'stale'
        : 'unknown',
    });
  }
  return [...unique.values()];
}

export function buildTimeline(evidence: EvidenceItem[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const item of evidence) {
    if (item.eventAt)
      entries.push({
        timestamp: item.eventAt,
        kind: 'event',
        label: item.title,
        evidenceIds: [item.evidenceId],
      });
    if (item.publishedAt)
      entries.push({
        timestamp: item.publishedAt,
        kind: 'publication',
        label: `${item.publisher} published`,
        evidenceIds: [item.evidenceId],
      });
    if (item.revisedAt)
      entries.push({
        timestamp: item.revisedAt,
        kind: 'revision',
        label: `${item.publisher} revised`,
        evidenceIds: [item.evidenceId],
      });
  }
  return entries.sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(?:utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
  }
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
  )
    url.port = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  url.searchParams.sort();
  return url.toString();
}

export function detectPromptInjection(value: string): string[] {
  return INJECTION_PATTERNS.filter(([, pattern]) => pattern.test(value)).map(([signal]) => signal);
}

export function safeEvidenceForSynthesis(item: EvidenceItem): EvidenceItem {
  if (item.injectionSignals.length === 0) return item;
  const { excerpt: _excerpt, ...safe } = item;
  return { ...safe, statement: '[Untrusted source text withheld after injection screening]' };
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
