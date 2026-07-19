export const ONBOARDING_CHECKPOINTS = [
  'key_viewed',
  'api_first_success',
  'mcp_first_success',
  'sdk_first_success',
] as const;
export type OnboardingCheckpoint = (typeof ONBOARDING_CHECKPOINTS)[number];

interface UsageBucket {
  requestCount: number;
  firstSuccessAt?: string;
  checkpoints: Partial<Record<OnboardingCheckpoint, string>>;
}

export class InMemoryUsageStore {
  readonly #buckets = new Map<string, UsageBucket>();
  readonly dailyQuota: number;

  constructor(dailyQuota = 100) {
    this.dailyQuota = dailyQuota;
  }

  consume(
    tenantId: string,
    now = Date.now(),
  ): { allowed: boolean; remaining: number; resetAt: string } {
    const key = bucketKey(tenantId, now);
    const bucket = this.#buckets.get(key) ?? { requestCount: 0, checkpoints: {} };
    if (bucket.requestCount >= this.dailyQuota) {
      return { allowed: false, remaining: 0, resetAt: resetAt(now) };
    }
    bucket.requestCount += 1;
    this.#buckets.set(key, bucket);
    return {
      allowed: true,
      remaining: this.dailyQuota - bucket.requestCount,
      resetAt: resetAt(now),
    };
  }

  checkpoint(tenantId: string, event: OnboardingCheckpoint, now = Date.now()): void {
    const key = bucketKey(tenantId, now);
    const bucket = this.#buckets.get(key) ?? { requestCount: 0, checkpoints: {} };
    bucket.checkpoints[event] ??= new Date(now).toISOString();
    if (event.endsWith('first_success')) bucket.firstSuccessAt ??= new Date(now).toISOString();
    this.#buckets.set(key, bucket);
  }

  summary(tenantId: string, now = Date.now()) {
    const bucket = this.#buckets.get(bucketKey(tenantId, now)) ?? {
      requestCount: 0,
      checkpoints: {},
    };
    return {
      tier: 'developer-evaluation',
      dailyQuota: this.dailyQuota,
      requestCount: bucket.requestCount,
      remaining: Math.max(0, this.dailyQuota - bucket.requestCount),
      resetAt: resetAt(now),
      checkpoints: structuredClone(bucket.checkpoints),
    };
  }
}

function bucketKey(tenantId: string, now: number): string {
  return `${tenantId}:${new Date(now).toISOString().slice(0, 10)}`;
}

function resetAt(now: number): string {
  const date = new Date(now);
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}
