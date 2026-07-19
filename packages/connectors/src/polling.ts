import type { WebhookEventEnvelope } from '@theneuralledger/events';

export interface PollingState {
  cursor: string | null;
  seen: string[];
  initialized: boolean;
}

export function advancePollingState(options: {
  state?: PollingState;
  events: readonly WebhookEventEnvelope[];
  nextCursor: string | null;
  backfillOnFirstRun?: boolean;
  seenLimit?: number;
}): { emitted: WebhookEventEnvelope[]; state: PollingState } {
  const state = options.state ?? { cursor: null, seen: [], initialized: false };
  const seen = new Set(state.seen);
  const fresh = options.events.filter((event) => !seen.has(event.id));
  const emitted = state.initialized || options.backfillOnFirstRun ? fresh : [];
  for (const event of options.events) seen.add(event.id);
  const limit = options.seenLimit ?? 5_000;
  const bounded = [...seen].slice(-limit);
  return {
    emitted,
    state: { cursor: options.nextCursor, seen: bounded, initialized: true },
  };
}
