import type { WebhookEventEnvelope, WebhookEventType } from './generated/events.js';

export interface SubscriptionFilters {
  categories?: readonly string[];
  geographies?: readonly string[];
  entities?: readonly string[];
  assets?: readonly string[];
  impactPaths?: readonly string[];
  minimumConfidence?: number;
  languages?: readonly string[];
}

export function matchesSubscription(
  event: WebhookEventEnvelope,
  eventTypes: readonly WebhookEventType[],
  filters: SubscriptionFilters,
): boolean {
  if (!eventTypes.includes(event.type)) return false;
  return (
    overlaps(filters.categories, event.data.categories) &&
    overlaps(filters.geographies, event.data.geographies) &&
    overlaps(filters.entities, event.data.entities) &&
    overlaps(filters.assets, event.data.assets) &&
    overlaps(filters.impactPaths, event.data.impactPaths) &&
    overlaps(filters.languages, event.data.language ? [event.data.language] : []) &&
    (filters.minimumConfidence === undefined ||
      (event.data.confidence !== undefined && event.data.confidence >= filters.minimumConfidence))
  );
}

export function normalizeFilters(filters: SubscriptionFilters = {}): SubscriptionFilters {
  if (
    filters.minimumConfidence !== undefined &&
    (!Number.isFinite(filters.minimumConfidence) ||
      filters.minimumConfidence < 0 ||
      filters.minimumConfidence > 1)
  )
    throw new Error('minimumConfidence must be between 0 and 1');
  return {
    ...normalized('categories', filters.categories, 30),
    ...normalized('geographies', filters.geographies, 30),
    ...normalized('entities', filters.entities, 100),
    ...normalized('assets', filters.assets, 100),
    ...normalized('impactPaths', filters.impactPaths, 30),
    ...normalized('languages', filters.languages, 30),
    ...(filters.minimumConfidence === undefined
      ? {}
      : { minimumConfidence: filters.minimumConfidence }),
  };
}

function overlaps(required: readonly string[] | undefined, actual: readonly string[]): boolean {
  if (!required || required.length === 0) return true;
  const values = new Set(actual.map(normalize));
  return required.some((value) => values.has(normalize(value)));
}

function normalized(
  field: keyof SubscriptionFilters,
  values: readonly string[] | undefined,
  maximum: number,
): Partial<SubscriptionFilters> {
  if (values === undefined) return {};
  if (
    values.length > maximum ||
    values.some(
      (value) => typeof value !== 'string' || value.trim().length === 0 || value.length > 160,
    )
  )
    throw new Error(`${field} is invalid`);
  return { [field]: [...new Set(values.map((value) => value.trim()))] };
}

function normalize(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-US');
}
