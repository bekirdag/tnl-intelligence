import type {
  ICredentialDataDecryptedObject,
  IExecuteFunctions,
  IHookFunctions,
  IHttpRequestOptions,
} from 'n8n-workflow';

export const TNL_WEBHOOK_EVENT_TYPES = [
  'intelligence.published',
  'intelligence.updated',
  'intelligence.retracted',
  'intelligence.impact_changed',
  'digest.weekly_published',
] as const;

export type TnlWebhookEventType = (typeof TNL_WEBHOOK_EVENT_TYPES)[number];
export type TnlOperation =
  | 'search_intelligence'
  | 'get_intelligence'
  | 'list_recent_changes'
  | 'get_exposure'
  | 'run_research'
  | 'get_research_result'
  | 'get_weekly_edition';

export interface TnlOperationRequest {
  operation: TnlOperation;
  input: Record<string, unknown>;
}

interface SubscriptionInput {
  endpoint: string;
  eventTypes: TnlWebhookEventType[];
  filters?: {
    categories?: string[];
    minimumConfidence?: number;
  };
}

interface SubscriptionResult {
  id: string;
  secret: string;
  keyId: string;
  state: string;
}

type RequestContext = IExecuteFunctions | IHookFunctions;

export async function executeTnlOperation(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject,
  request: TnlOperationRequest,
): Promise<Record<string, unknown>> {
  const input = request.input;
  switch (request.operation) {
    case 'search_intelligence': {
      const query = required(input.query, 'query');
      const page = await apiRequest(context, credentials, '/v1/search', {
        qs: pageQuery(input, { q: query }),
      });
      return result(request.operation, normalizePage(page, Boolean(input.includeBody)));
    }
    case 'get_intelligence': {
      const id = identifier(input.id);
      const story = await apiRequest(
        context,
        credentials,
        `/v1/news/${encodeURIComponent(id)}`,
        { qs: { include: input.includeBody ? 'sources,claims' : 'sources' } },
      );
      return result(request.operation, normalizeStory(record(story), Boolean(input.includeBody)));
    }
    case 'list_recent_changes': {
      const page = await apiRequest(context, credentials, '/v1/news', {
        qs: pageQuery(input, {
          updated_since: timestamp(input.since, 'since'),
          sort: 'pipeline',
        }),
      });
      return result(request.operation, normalizePage(page));
    }
    case 'get_exposure': {
      const id = identifier(input.value);
      const kind = required(input.kind, 'kind');
      const resource =
        kind === 'entity'
          ? 'entities'
          : kind === 'asset'
            ? 'assets'
            : kind === 'impact_path'
              ? 'impact-paths'
              : undefined;
      if (!resource) throw new Error('Exposure kind is invalid');
      const page = await apiRequest(
        context,
        credentials,
        `/v1/${resource}/${encodeURIComponent(id)}/stories`,
        { qs: pageQuery(input) },
      );
      return result(request.operation, normalizePage(page));
    }
    case 'run_research': {
      const task = researchTask({
        workflowId: required(input.workflowId, 'workflowId'),
        question: required(input.question, 'question'),
        ...(input.from ? { from: timestamp(input.from, 'from') } : {}),
        ...(input.to ? { to: timestamp(input.to, 'to') } : {}),
      });
      return result(request.operation, await researchRequest(context, credentials, task));
    }
    case 'get_research_result': {
      return result(
        request.operation,
        await researchResultRequest(
          context,
          credentials,
          identifier(input.resultId),
        ),
      );
    }
    case 'get_weekly_edition': {
      const to = input.weekEnding ? timestamp(input.weekEnding, 'weekEnding') : new Date().toISOString();
      const from = new Date(Date.parse(to) - 7 * 86_400_000).toISOString();
      const task = researchTask({
        workflowId: 'weekly-consequential',
        question: 'What were the most consequential developments in this period?',
        from,
        to,
      });
      return result(request.operation, await researchRequest(context, credentials, task));
    }
  }
}

export async function createTnlSubscription(
  context: IHookFunctions,
  credentials: ICredentialDataDecryptedObject,
  input: SubscriptionInput,
): Promise<SubscriptionResult> {
  const payload = record(
    await request(context, {
      method: 'POST',
      url: endpoint(credentials.webhookUrl, '/v1/webhooks/subscriptions'),
      headers: authorization(credentials),
      body: input,
      json: true,
      timeout: 15_000,
    }),
  );
  const data = record(payload.data);
  const subscription = record(data.subscription);
  return {
    id: required(subscription.id, 'subscription id'),
    secret: required(data.secret, 'webhook secret'),
    keyId: required(subscription.activeKeyId, 'webhook key id'),
    state: string(subscription.state) ?? 'pending',
  };
}

export async function deleteTnlSubscription(
  context: IHookFunctions,
  credentials: ICredentialDataDecryptedObject,
  subscriptionId: string,
): Promise<void> {
  await request(context, {
    method: 'DELETE',
    url: endpoint(
      credentials.webhookUrl,
      `/v1/webhooks/subscriptions/${encodeURIComponent(identifier(subscriptionId))}`,
    ),
    headers: authorization(credentials),
    json: true,
    timeout: 15_000,
  });
}

export async function processTnlWebhook(options: {
  rawBody: Buffer;
  headers: Record<string, string | string[] | undefined>;
  secret: string;
  keyId: string;
  replayStore: { claim(id: string, expiresAt: number): boolean | Promise<boolean> };
  eventDedupeStore: { claim(id: string, expiresAt: number): boolean | Promise<boolean> };
  now?: number;
}): Promise<Record<string, unknown>> {
  const deliveryId = header(options.headers, 'tnl-webhook-id');
  const timestampText = header(options.headers, 'tnl-webhook-timestamp');
  const keyId = header(options.headers, 'tnl-webhook-key-id');
  const supplied = header(options.headers, 'tnl-webhook-signature');
  if (!/^dlv_[A-Za-z0-9_-]{12,100}$/.test(deliveryId)) throw new Error('Invalid webhook ID');
  if (keyId !== options.keyId) throw new Error('Unknown webhook key');
  const unixTime = Number(timestampText);
  const now = options.now ?? Math.floor(Date.now() / 1_000);
  if (!Number.isInteger(unixTime) || Math.abs(now - unixTime) > 300)
    throw new Error('Webhook timestamp is invalid');
  const signature = supplied.match(/^v1=([a-f0-9]{64})$/)?.[1];
  if (!signature) throw new Error('Webhook signature is invalid');
  const expected = await hmacHex(
    decodeSecret(options.secret),
    Buffer.concat([
      Buffer.from(`v1.${unixTime}.${deliveryId}.`, 'utf8'),
      options.rawBody,
    ]),
  );
  if (!constantTimeEqual(expected, signature)) throw new Error('Webhook signature is invalid');
  if (!(await options.replayStore.claim(deliveryId, (unixTime + 300) * 1_000)))
    throw new Error('Webhook delivery was already processed');

  const envelope = record(JSON.parse(options.rawBody.toString('utf8')));
  const resource = record(envelope.resource);
  const data = record(envelope.data);
  const eventId = required(envelope.id, 'event id');
  const eventType = required(envelope.type, 'event type');
  if (!TNL_WEBHOOK_EVENT_TYPES.includes(eventType as TnlWebhookEventType))
    throw new Error('Webhook event type is invalid');
  const revision = number(resource.revision);
  if (!revision || revision < 1) throw new Error('Webhook revision is invalid');
  const eventClaim = `${eventId}:${revision}`;
  if (!(await options.eventDedupeStore.claim(eventClaim, Date.now() + 7 * 86_400_000)))
    throw new Error('Webhook event was already processed');
  return {
    id: eventClaim,
    deliveryId,
    type: eventType,
    occurredAt: required(envelope.occurredAt, 'occurredAt'),
    publishedAt: required(envelope.publishedAt, 'publishedAt'),
    resourceId: required(resource.id, 'resource id'),
    revision,
    canonicalUrl: string(resource.url),
    summary: string(data.summary),
    categories: strings(data.categories),
    geographies: strings(data.geographies),
    entities: strings(data.entities),
    assets: strings(data.assets),
    impactPaths: strings(data.impactPaths),
    confidence: number(data.confidence),
    envelope,
  };
}

async function apiRequest(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject,
  path: string,
  options: Partial<IHttpRequestOptions> = {},
): Promise<unknown> {
  return request(context, {
    method: 'GET',
    url: endpoint(credentials.baseUrl, path),
    headers: authorization(credentials),
    json: true,
    timeout: 30_000,
    ...options,
  });
}

async function researchRequest(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject,
  task: Record<string, unknown>,
): Promise<unknown> {
  const payload = record(
    await request(context, {
      method: 'POST',
      url: endpoint(credentials.researchUrl, '/api/research/runs'),
      headers: authorization(credentials),
      body: { task },
      json: true,
      timeout: 45_000,
    }),
  );
  if (!payload.data) throw new Error('The research response is invalid');
  return payload.data;
}

async function researchResultRequest(
  context: IExecuteFunctions,
  credentials: ICredentialDataDecryptedObject,
  resultId: string,
): Promise<unknown> {
  const payload = record(
    await request(context, {
      method: 'GET',
      url: endpoint(
        credentials.researchUrl,
        `/api/research/runs/${encodeURIComponent(resultId)}`,
      ),
      headers: authorization(credentials),
      json: true,
      timeout: 30_000,
    }),
  );
  if (!payload.data) throw new Error('The research response is invalid');
  return payload.data;
}

async function request(context: RequestContext, options: IHttpRequestOptions): Promise<unknown> {
  return context.helpers.httpRequest(options);
}

function researchTask(input: {
  workflowId: string;
  question: string;
  from?: string;
  to?: string;
}): Record<string, unknown> {
  const taskTypes: Record<string, string> = {
    'what-changed': 'what_changed',
    'compare-sources': 'source_comparison',
    'validate-event': 'event_validation',
    'asset-exposure': 'asset_entity_exposure',
    'operational-risk': 'geopolitical_operational_risk',
    'weekly-consequential': 'weekly_consequential',
  };
  const taskType = taskTypes[input.workflowId];
  if (!taskType) throw new Error('Research workflow is invalid');
  const to = input.to ?? new Date().toISOString();
  const from = input.from ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString();
  return {
    schemaVersion: '1.0',
    taskId: `task_n8n_${Date.now().toString(36)}`,
    taskType,
    question: input.question.trim(),
    asOf: to,
    timeWindow: { from, to },
    depth: 'standard',
    sourcePolicy: {
      version: 'research-sources-1',
      requirePrimary: taskType === 'event_validation',
      minimumIndependentSources: taskType === 'weekly_consequential' ? 3 : 2,
      freshnessMs: 7 * 86_400_000,
    },
    budget: {
      maxToolCalls: 12,
      maxDurationMs: 45_000,
      maxInputTokens: 24_000,
      maxOutputTokens: 4_000,
      maxSources: 20,
      maxCostUsd: 0.25,
    },
    outputFormat: 'json',
    locale: 'en',
  };
}

function normalizePage(value: unknown, includeBody = false): Record<string, unknown> {
  const page = record(value);
  const metadata = record(page.page);
  const items = Array.isArray(page.data)
    ? page.data.map((story) => normalizeStory(record(story), includeBody))
    : [];
  return {
    items,
    nextCursor: string(metadata.next_cursor),
    asOf: iso(page.lastSyncAt) ?? new Date().toISOString(),
    count: items.length,
  };
}

function normalizeStory(story: Record<string, unknown>, includeBody = false): Record<string, unknown> {
  const id = required(story.id, 'story id');
  const sources = Array.isArray(story.sources) ? story.sources.map(record) : [];
  return {
    id,
    revision: number(story.revision) ?? number(story.version) ?? 1,
    title: string(story.title),
    summary: string(story.excerpt),
    category: string(story.category),
    canonicalUrl:
      string(story.canonicalUrl) ??
      `https://theneuralledger.com/news/${encodeURIComponent(string(story.slug) ?? id)}`,
    eventAt: iso(story.date),
    publishedAt: iso(story.publishedAt),
    updatedAt: iso(story.updatedAt),
    retrievedAt: new Date().toISOString(),
    status: string(story.storyStatus),
    impact: string(story.impact),
    confidence: number(story.truthPosterior),
    entities: unique([...strings(story.passiveEntities), ...strings(story.entities)]),
    assets: unique(strings(story.impactedAssets)),
    impactPaths: unique(strings(story.impactPaths)),
    citations: sources.flatMap((source) => {
      const url = string(source.url);
      return url ? [{ label: string(source.name) ?? string(source.label) ?? 'Source', url }] : [];
    }),
    ...(includeBody && typeof story.body === 'string' ? { body: story.body } : {}),
  };
}

function pageQuery(
  input: Record<string, unknown>,
  extra: Record<string, string | number> = {},
): Record<string, string | number> {
  const size = number(input.pageSize) ?? 50;
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error('Page size is invalid');
  return compact({
    page_size: size,
    cursor: string(input.cursor),
    published_since: input.from ? timestamp(input.from, 'from') : undefined,
    published_until: input.to ? timestamp(input.to, 'to') : undefined,
    category: string(input.category),
    country: string(input.geography),
    entity: string(input.entity),
    impact_path: string(input.impactPath),
    ...extra,
  });
}

function endpoint(base: unknown, path: string): string {
  const url = new URL(required(base, 'service URL'));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Service URL is invalid');
  return `${url.toString().replace(/\/$/, '')}${path}`;
}

function authorization(credentials: ICredentialDataDecryptedObject): Record<string, string> {
  return {
    authorization: `Bearer ${required(credentials.apiKey, 'API key')}`,
    accept: 'application/json',
    'content-type': 'application/json',
    'user-agent': 'n8n-nodes-tnl-intelligence/0.1.0',
  };
}

async function hmacHex(secret: Uint8Array, message: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    ownedBuffer(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, ownedBuffer(message)),
  );
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function decodeSecret(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw new Error('Webhook secret is invalid');
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.byteLength < 32 || decoded.byteLength > 64) throw new Error('Webhook secret is invalid');
  return new Uint8Array(decoded);
}

function ownedBuffer(value: Uint8Array): ArrayBuffer {
  return Uint8Array.from(value).buffer;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1)
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function header(headers: Record<string, string | string[] | undefined>, name: string): string {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name && typeof value === 'string' && value.length <= 500) return value;
  }
  throw new Error(`Missing ${name} header`);
}

function result(operation: TnlOperation, data: unknown): Record<string, unknown> {
  return { operation, data };
}

function required(value: unknown, field: string): string {
  const output = string(value);
  if (!output) throw new Error(`${field} is required`);
  return output;
}

function identifier(value: unknown): string {
  const output = required(value, 'identifier');
  if (output.length > 256) throw new Error('identifier is invalid');
  return output;
}

function timestamp(value: unknown, field: string): string {
  const parsed = Date.parse(required(value, field));
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

function iso(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(Date.parse(value)).toISOString()
    : null;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function compact(
  values: Record<string, string | number | null | undefined>,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string | number] => entry[1] != null),
  );
}
