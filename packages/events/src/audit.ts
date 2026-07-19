export type WebhookAuditAction =
  | 'subscription_created'
  | 'subscription_activated'
  | 'subscription_paused'
  | 'subscription_disabled'
  | 'subscription_rotated'
  | 'subscription_deleted'
  | 'delivery_replayed';

export interface WebhookAuditEvent {
  action: WebhookAuditAction;
  ownerId: string;
  tenantId: string;
  targetId: string;
  occurredAt: string;
  reason: string;
}

export interface WebhookAuditSink {
  emit(event: WebhookAuditEvent): Promise<void>;
}

export class MemoryWebhookAuditSink implements WebhookAuditSink {
  readonly events: WebhookAuditEvent[] = [];

  async emit(event: WebhookAuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

export class NullWebhookAuditSink implements WebhookAuditSink {
  async emit(_event: WebhookAuditEvent): Promise<void> {}
}
