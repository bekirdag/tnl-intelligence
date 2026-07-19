import { createHash } from 'node:crypto';
import {
  DEFAULT_RESEARCH_BUDGET,
  validateResearchTask,
  type ResearchTask,
} from '@theneuralledger/research';
import { getAdapterWorkflow } from './catalog.js';
import type { ResearchTaskRequest } from './contracts.js';

const DAY_MS = 86_400_000;

export interface BuiltResearchTask {
  task: ResearchTask;
  timeWindowSource: 'explicit' | 'default-seven-days';
}

export function buildResearchTask(
  request: ResearchTaskRequest,
  now: Date = new Date(),
): BuiltResearchTask {
  const workflow = getAdapterWorkflow(request.workflowId);
  const asOf = iso(request.asOf ?? request.to ?? now.toISOString(), 'asOf');
  const to = iso(request.to ?? asOf, 'to');
  const explicit = request.from !== undefined;
  const from = explicit
    ? iso(request.from as string, 'from')
    : new Date(Date.parse(to) - 7 * DAY_MS).toISOString();
  const task: ResearchTask = {
    schemaVersion: '1.0',
    taskId: taskId(request, workflow.id, from, to),
    taskType: workflow.taskType,
    question: request.question.trim(),
    asOf,
    timeWindow: { from, to },
    ...(request.storyIds ? { selectedStoryIds: boundedList(request.storyIds, 'storyIds') } : {}),
    ...(request.entities ? { entities: boundedList(request.entities, 'entities') } : {}),
    ...(request.geographies
      ? { geographies: boundedList(request.geographies, 'geographies') }
      : {}),
    ...(request.categories ? { categories: boundedList(request.categories, 'categories') } : {}),
    ...(request.assets ? { assets: boundedList(request.assets, 'assets') } : {}),
    depth: request.depth ?? 'standard',
    sourcePolicy: {
      version: 'research-sources-1',
      requirePrimary: workflow.taskType === 'event_validation',
      minimumIndependentSources: workflow.taskType === 'weekly_consequential' ? 3 : 2,
      freshnessMs: 7 * DAY_MS,
    },
    budget: { ...DEFAULT_RESEARCH_BUDGET },
    outputFormat: 'json',
    locale: request.locale ?? 'en',
  };
  validateResearchTask(task);
  return { task, timeWindowSource: explicit ? 'explicit' : 'default-seven-days' };
}

function taskId(request: ResearchTaskRequest, workflow: string, from: string, to: string): string {
  if (request.requestId) {
    const normalized = request.requestId.replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 96);
    if (normalized.length >= 3) return `task_${normalized}`;
  }
  const digest = createHash('sha256')
    .update(JSON.stringify([workflow, request.question.trim(), from, to]))
    .digest('hex')
    .slice(0, 24);
  return `task_adapter_${digest}`;
}

function iso(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TypeError(`${field} must be an ISO 8601 timestamp`);
  return new Date(timestamp).toISOString();
}

function boundedList(values: string[], field: string): string[] {
  if (values.length > 100) throw new TypeError(`${field} cannot contain more than 100 values`);
  const output = values.map((value) => value.trim()).filter(Boolean);
  if (output.length !== values.length) throw new TypeError(`${field} contains an empty value`);
  return output;
}
