import type { AdapterHost } from './contracts.js';

export type AdapterTelemetryName =
  | 'capability_checked'
  | 'workflow_started'
  | 'workflow_completed'
  | 'workflow_partial'
  | 'workflow_failed';

export interface AdapterTelemetryInput {
  name: AdapterTelemetryName;
  host: AdapterHost;
  adapterVersion: string;
  workflowId?: string;
  outcome?: 'success' | 'partial' | 'failure';
  errorCode?: string;
  durationMs?: number;
  requestIdHash?: string;
}

export interface AdapterTelemetryEvent extends AdapterTelemetryInput {
  schemaVersion: '1.0';
}

export function createTelemetryEvent(input: AdapterTelemetryInput): AdapterTelemetryEvent {
  if (
    input.durationMs !== undefined &&
    (!Number.isFinite(input.durationMs) || input.durationMs < 0)
  )
    throw new TypeError('Telemetry duration must be a non-negative number');
  if (input.requestIdHash && !/^[a-f0-9]{16,64}$/.test(input.requestIdHash))
    throw new TypeError('Telemetry request ID must be a one-way hexadecimal hash');
  return Object.freeze({ schemaVersion: '1.0', ...input });
}
