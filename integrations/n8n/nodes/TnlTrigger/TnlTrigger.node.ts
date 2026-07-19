import type {
  IDataObject,
  IHookFunctions,
  INodeType,
  INodeTypeDescription,
  IWebhookFunctions,
  IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
  createTnlSubscription,
  deleteTnlSubscription,
  processTnlWebhook,
  type TnlWebhookEventType,
} from '../shared/runtime';

interface TriggerState extends IDataObject {
  subscriptionId?: string;
  webhookSecret?: string;
  webhookKeyId?: string;
  deliveries?: string[];
  events?: string[];
}

export class TnlTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'TNL Trigger',
    name: 'tnlTrigger',
    icon: {
      light: 'file:../../icons/tnl-bot.svg',
      dark: 'file:../../icons/tnl-bot-dark.svg',
    },
    group: ['trigger'],
    version: 1,
    subtitle: '={{$parameter["eventTypes"].join(", ")}}',
    description: 'Receive signed new, revised, retracted, impact, and weekly TNL events',
    defaults: { name: 'TNL Trigger' },
    inputs: [],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'tnlApi', required: true }],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'tnl-intelligence',
      },
    ],
    properties: [
      {
        displayName: 'Event Types',
        name: 'eventTypes',
        type: 'multiOptions',
        options: [
          { name: 'Impact Classification Changed', value: 'intelligence.impact_changed' },
          { name: 'Intelligence Published', value: 'intelligence.published' },
          { name: 'Intelligence Retracted', value: 'intelligence.retracted' },
          { name: 'Intelligence Updated', value: 'intelligence.updated' },
          { name: 'Weekly Edition Published', value: 'digest.weekly_published' },
        ],
        default: ['intelligence.published', 'intelligence.updated'],
        required: true,
      },
      {
        displayName: 'Categories',
        name: 'categories',
        type: 'string',
        default: '',
        description: 'Optional comma-separated exact category filters',
      },
      {
        displayName: 'Minimum Confidence',
        name: 'minimumConfidence',
        type: 'number',
        typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 2 },
        default: 0,
      },
    ],
  };

  webhookMethods = {
    default: {
      checkExists: async function (this: IHookFunctions): Promise<boolean> {
        return Boolean(state(this).subscriptionId);
      },
      create: async function (this: IHookFunctions): Promise<boolean> {
        const credentials = await this.getCredentials('tnlApi');
        const endpoint = this.getNodeWebhookUrl('default');
        if (!endpoint) throw new NodeOperationError(this.getNode(), 'Webhook URL is unavailable');
        const categories = comma(this.getNodeParameter('categories') as string);
        const minimumConfidence = this.getNodeParameter('minimumConfidence') as number;
        const subscription = await createTnlSubscription(this, credentials, {
          endpoint,
          eventTypes: this.getNodeParameter('eventTypes') as TnlWebhookEventType[],
          filters: {
            ...(categories.length ? { categories } : {}),
            ...(minimumConfidence > 0 ? { minimumConfidence } : {}),
          },
        });
        Object.assign(state(this), {
          subscriptionId: subscription.id,
          webhookSecret: subscription.secret,
          webhookKeyId: subscription.keyId,
          deliveries: [],
          events: [],
        });
        return true;
      },
      delete: async function (this: IHookFunctions): Promise<boolean> {
        const data = state(this);
        if (!data.subscriptionId) return true;
        const credentials = await this.getCredentials('tnlApi');
        await deleteTnlSubscription(this, credentials, data.subscriptionId);
        for (const key of ['subscriptionId', 'webhookSecret', 'webhookKeyId', 'deliveries', 'events'])
          delete data[key];
        return true;
      },
    },
  };

  async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
    const data = state(this);
    if (!data.webhookSecret || !data.webhookKeyId)
      throw new NodeOperationError(this.getNode(), 'TNL webhook is not activated');
    const request = this.getRequestObject() as ReturnType<IWebhookFunctions['getRequestObject']> & {
      rawBody?: Buffer;
    };
    if (!request.rawBody)
      throw new NodeOperationError(this.getNode(), 'TNL webhook requires exact raw request bytes');
    const result = await processTnlWebhook({
      rawBody: request.rawBody,
      headers: request.headers,
      secret: data.webhookSecret,
      keyId: data.webhookKeyId,
      replayStore: listStore(data, 'deliveries'),
      eventDedupeStore: listStore(data, 'events'),
    });
    return { workflowData: [this.helpers.returnJsonArray([result as unknown as IDataObject])] };
  }
}

function state(context: IHookFunctions | IWebhookFunctions): TriggerState {
  return context.getWorkflowStaticData('node') as TriggerState;
}

function listStore(data: TriggerState, field: 'deliveries' | 'events') {
  return {
    claim(id: string): boolean {
      const values = data[field] ?? [];
      if (values.includes(id)) return false;
      data[field] = [...values, id].slice(-5_000);
      return true;
    },
  };
}

function comma(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}
