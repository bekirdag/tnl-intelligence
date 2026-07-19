import { processConnectorWebhook } from '@theneuralledger/connectors';
import { appProp, subscriptionsFor } from '../../common.mjs';

export default {
  key: 'tnl_intelligence-new-or-updated-intelligence',
  name: 'New or Updated TNL Intelligence',
  description: 'Emit verified, deduplicated TNL publication, revision, retraction, impact, and weekly events.',
  version: '0.1.0',
  dedupe: 'unique',
  props: {
    tnl: appProp,
    db: '$.service.db',
    http: { type: '$.interface.http', customResponse: true },
    eventTypes: {
      type: 'string[]',
      label: 'Event Types',
      options: [
        'intelligence.published',
        'intelligence.updated',
        'intelligence.retracted',
        'intelligence.impact_changed',
        'digest.weekly_published',
      ],
      default: ['intelligence.published', 'intelligence.updated'],
    },
    categories: { type: 'string[]', label: 'Categories', optional: true },
    minimumConfidence: { type: 'number', label: 'Minimum Confidence', min: 0, max: 1, optional: true },
  },
  hooks: {
    async deploy() {
      const subscription = await subscriptionsFor(this.tnl).create({
        endpoint: this.http.endpoint,
        eventTypes: this.eventTypes,
        filters: {
          ...(this.categories?.length ? { categories: this.categories } : {}),
          ...(this.minimumConfidence !== undefined ? { minimumConfidence: this.minimumConfidence } : {}),
        },
      });
      await this.db.set('subscription', subscription);
      await this.db.set('deliveries', []);
      await this.db.set('events', []);
    },
    async deactivate() {
      const subscription = await this.db.get('subscription');
      if (subscription?.id) await subscriptionsFor(this.tnl).remove(subscription.id);
      await this.db.set('subscription', undefined);
      await this.db.set('deliveries', []);
      await this.db.set('events', []);
    },
  },
  async run(event) {
    const subscription = await this.db.get('subscription');
    if (!subscription?.secret || !subscription?.keyId) throw new Error('TNL subscription is not active');
    try {
      const result = await processConnectorWebhook({
        rawBody: event.bodyRaw,
        headers: event.headers,
        secret: subscription.secret,
        keyId: subscription.keyId,
        replayStore: dbStore(this.db, 'deliveries'),
        eventDedupeStore: dbStore(this.db, 'events'),
      });
      this.http.respond({ status: 200, body: { accepted: true } });
      this.$emit(result, {
        id: result.id,
        summary: `${result.type}: ${result.summary}`.slice(0, 200),
        ts: Date.parse(result.occurredAt),
      });
    } catch (error) {
      if (error?.code === 'duplicate_event') {
        this.http.respond({ status: 200, body: { accepted: true, duplicate: true } });
        return;
      }
      this.http.respond({ status: 401, body: { accepted: false } });
      throw error;
    }
  },
};

function dbStore(db, key) {
  return {
    async claim(id) {
      const values = (await db.get(key)) ?? [];
      if (values.includes(id)) return false;
      await db.set(key, [...values, id].slice(-5_000));
      return true;
    },
  };
}
