import { randomBytes } from 'node:crypto';
import {
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_SCHEMA_VERSION,
  type WebhookEventData,
  type WebhookEventEnvelope,
  type WebhookEventType,
  type WebhookResource,
} from './generated/events.js';

export type {
  WebhookEventData,
  WebhookEventEnvelope,
  WebhookEventType,
  WebhookResource,
} from './generated/events.js';
export { WEBHOOK_EVENT_TYPES, WEBHOOK_SCHEMA_VERSION } from './generated/events.js';

export interface CreateWebhookEventInput {
  type: WebhookEventType;
  tenantId: string;
  resource: WebhookResource;
  data: WebhookEventData;
  occurredAt: string;
  traceId: string;
  publishedAt?: string;
  id?: string;
}

export function createWebhookEvent(input: CreateWebhookEventInput): WebhookEventEnvelope {
  const event: WebhookEventEnvelope = {
    id: input.id ?? `evt_${randomBytes(18).toString('base64url')}`,
    type: input.type,
    schemaVersion: WEBHOOK_SCHEMA_VERSION,
    occurredAt: input.occurredAt,
    publishedAt: input.publishedAt ?? new Date().toISOString(),
    tenantId: input.tenantId,
    resource: structuredClone(input.resource),
    data: structuredClone(input.data),
    metadata: { producer: 'tnl', traceId: input.traceId },
  };
  const problems = validateWebhookEvent(event);
  if (problems.length > 0) throw new WebhookContractError(problems);
  return event;
}

export function validateWebhookEvent(value: unknown): string[] {
  if (!record(value)) return ['envelope must be an object'];
  const problems: string[] = [];
  exactKeys(
    value,
    [
      'id',
      'type',
      'schemaVersion',
      'occurredAt',
      'publishedAt',
      'tenantId',
      'resource',
      'data',
      'metadata',
    ],
    'envelope',
    problems,
  );
  if (!matches(value.id, /^evt_[A-Za-z0-9_-]{12,80}$/)) problems.push('id is invalid');
  if (!(WEBHOOK_EVENT_TYPES as readonly unknown[]).includes(value.type))
    problems.push('type is unsupported');
  if (value.schemaVersion !== WEBHOOK_SCHEMA_VERSION) problems.push('schemaVersion is unsupported');
  date(value.occurredAt, 'occurredAt', problems);
  date(value.publishedAt, 'publishedAt', problems);
  boundedString(value.tenantId, 'tenantId', 1, 120, problems);
  validateResource(value.resource, problems);
  validateData(value.data, problems);
  validateMetadata(value.metadata, problems);
  if (Buffer.byteLength(JSON.stringify(value)) > 64 * 1024) problems.push('event exceeds 64 KiB');
  return problems;
}

export class WebhookContractError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Invalid webhook event: ${problems.join('; ')}`);
    this.name = 'WebhookContractError';
  }
}

function validateResource(value: unknown, problems: string[]): void {
  if (!record(value)) {
    problems.push('resource must be an object');
    return;
  }
  exactKeys(value, ['id', 'revision', 'url'], 'resource', problems);
  boundedString(value.id, 'resource.id', 1, 160, problems);
  if (!Number.isInteger(value.revision) || Number(value.revision) < 1)
    problems.push('resource.revision must be a positive integer');
  boundedString(value.url, 'resource.url', 1, 2048, problems);
  try {
    const url = new URL(String(value.url));
    if (url.protocol !== 'https:') problems.push('resource.url must use https');
  } catch {
    problems.push('resource.url must be an absolute URL');
  }
}

function validateData(value: unknown, problems: string[]): void {
  if (!record(value)) {
    problems.push('data must be an object');
    return;
  }
  exactKeys(
    value,
    [
      'summary',
      'categories',
      'geographies',
      'entities',
      'assets',
      'impactPaths',
      'confidence',
      'language',
      'provenance',
    ],
    'data',
    problems,
    ['confidence', 'language'],
  );
  boundedString(value.summary, 'data.summary', 0, 2000, problems);
  stringArray(value.categories, 'data.categories', 30, 120, problems);
  stringArray(value.geographies, 'data.geographies', 30, 120, problems);
  stringArray(value.entities, 'data.entities', 100, 160, problems);
  stringArray(value.assets, 'data.assets', 100, 80, problems);
  stringArray(value.impactPaths, 'data.impactPaths', 30, 160, problems);
  stringArray(value.provenance, 'data.provenance', 100, 2048, problems);
  if (
    value.confidence !== undefined &&
    (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1)
  )
    problems.push('data.confidence must be between 0 and 1');
  if (value.language !== undefined && !matches(value.language, /^[a-z]{2,3}(?:-[A-Z]{2})?$/))
    problems.push('data.language is invalid');
  if (Array.isArray(value.provenance)) {
    for (const item of value.provenance) {
      try {
        new URL(String(item));
      } catch {
        problems.push('data.provenance items must be absolute URLs');
        break;
      }
    }
  }
}

function validateMetadata(value: unknown, problems: string[]): void {
  if (!record(value)) {
    problems.push('metadata must be an object');
    return;
  }
  exactKeys(value, ['producer', 'traceId'], 'metadata', problems);
  if (value.producer !== 'tnl') problems.push('metadata.producer must be tnl');
  boundedString(value.traceId, 'metadata.traceId', 8, 120, problems);
}

function exactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  field: string,
  problems: string[],
  optional: readonly string[] = [],
): void {
  for (const key of keys) {
    if (!optional.includes(key) && !(key in value)) problems.push(`${field}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) problems.push(`${field}.${key} is not allowed`);
  }
}

function stringArray(
  value: unknown,
  field: string,
  maximumItems: number,
  maximumLength: number,
  problems: string[],
): void {
  if (
    !Array.isArray(value) ||
    value.length > maximumItems ||
    value.some((item) => typeof item !== 'string' || item.length > maximumLength)
  )
    problems.push(`${field} is invalid`);
}

function boundedString(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  problems: string[],
): void {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum)
    problems.push(`${field} is invalid`);
}

function date(value: unknown, field: string, problems: string[]): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    problems.push(`${field} must be an ISO timestamp`);
}

function matches(value: unknown, pattern: RegExp): boolean {
  return typeof value === 'string' && pattern.test(value);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
