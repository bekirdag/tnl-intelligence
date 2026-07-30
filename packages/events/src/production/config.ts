/**
 * Production configuration for the webhook service.
 *
 * Non-secret settings live in a YAML document that is deployed with the
 * release; secrets are read from the environment (systemd credentials) and are
 * never written to the configuration file.
 */
import { readFile } from 'node:fs/promises';

export interface WebhookServiceConfig {
  service: {
    bindHost: string;
    bindPort: number;
    producerEnabled: boolean;
    dispatcherEnabled: boolean;
    relayEnabled: boolean;
    autoVerifyOnCreate: boolean;
    workerIntervalMs: number;
    workerBatch: number;
    requestTimeoutMs: number;
    maximumAttempts: number;
    baseDelayMs: number;
    maximumDelayMs: number;
    maximumRetryAfterMs: number;
    detailedHistoryDays: number;
    deadLetterDays: number;
    auditDays: number;
    outboxDays: number;
  };
  database: {
    urlEnv: string;
    maxConnections: number;
  };
  kms: {
    provider: string;
    keyringPathEnv: string;
  };
  identity: {
    defaultTenantId: string;
    requestsPerMinute: number;
    operatorSubjects: string[];
    operatorRole: string;
    deniedPlans: string[];
    tenantOverrides: Record<string, string>;
    mysqlHost: string;
    mysqlPort: number;
    mysqlUser: string;
    mysqlDatabase: string;
    mysqlPasswordEnv: string;
    keycloakJwksUrl: string;
    keycloakIssuers: string[];
    keycloakAudiences: string[];
  };
  egress: {
    requireHttps: boolean;
    allowedPorts: number[];
  };
}

const DEFAULTS: WebhookServiceConfig = {
  service: {
    bindHost: '127.0.0.1',
    bindPort: 7322,
    producerEnabled: false,
    dispatcherEnabled: true,
    relayEnabled: true,
    autoVerifyOnCreate: true,
    workerIntervalMs: 1_000,
    workerBatch: 100,
    requestTimeoutMs: 10_000,
    maximumAttempts: 8,
    baseDelayMs: 5_000,
    maximumDelayMs: 3_600_000,
    maximumRetryAfterMs: 3_600_000,
    detailedHistoryDays: 30,
    deadLetterDays: 14,
    auditDays: 180,
    outboxDays: 7,
  },
  database: { urlEnv: 'TNL_WEBHOOK_DATABASE_URL', maxConnections: 8 },
  kms: { provider: 'local-keyring', keyringPathEnv: 'TNL_WEBHOOK_KEYRING_PATH' },
  identity: {
    defaultTenantId: 'tnl_public',
    requestsPerMinute: 120,
    operatorSubjects: [],
    operatorRole: 'tnl-webhook-operator',
    deniedPlans: [],
    tenantOverrides: {},
    mysqlHost: '127.0.0.1',
    mysqlPort: 3306,
    mysqlUser: 'theneuralledger',
    mysqlDatabase: 'theneuralledger',
    mysqlPasswordEnv: 'TNL_WEBHOOK_MYSQL_PASSWORD',
    keycloakJwksUrl: '',
    keycloakIssuers: [],
    keycloakAudiences: [],
  },
  egress: { requireHttps: true, allowedPorts: [443] },
};

export async function loadWebhookServiceConfig(path: string): Promise<WebhookServiceConfig> {
  return parseWebhookServiceConfig(await readFile(path, 'utf8'));
}

export function parseWebhookServiceConfig(source: string): WebhookServiceConfig {
  const document = parseSimpleYaml(source);
  const service = section(document, 'service');
  const database = section(document, 'database');
  const kms = section(document, 'kms');
  const identity = section(document, 'identity');
  const egress = section(document, 'egress');
  return {
    service: {
      bindHost: text(service.bind_host, DEFAULTS.service.bindHost),
      bindPort: integer(service.bind_port, DEFAULTS.service.bindPort, 1, 65_535),
      producerEnabled: flag(service.producer_enabled, DEFAULTS.service.producerEnabled),
      dispatcherEnabled: flag(service.dispatcher_enabled, DEFAULTS.service.dispatcherEnabled),
      relayEnabled: flag(service.relay_enabled, DEFAULTS.service.relayEnabled),
      autoVerifyOnCreate: flag(service.auto_verify_on_create, DEFAULTS.service.autoVerifyOnCreate),
      workerIntervalMs: integer(
        service.worker_interval_ms,
        DEFAULTS.service.workerIntervalMs,
        100,
        60_000,
      ),
      workerBatch: integer(service.worker_batch, DEFAULTS.service.workerBatch, 1, 1_000),
      requestTimeoutMs: integer(
        service.request_timeout_ms,
        DEFAULTS.service.requestTimeoutMs,
        1_000,
        60_000,
      ),
      maximumAttempts: integer(service.maximum_attempts, DEFAULTS.service.maximumAttempts, 1, 20),
      baseDelayMs: integer(service.base_delay_ms, DEFAULTS.service.baseDelayMs, 100, 600_000),
      maximumDelayMs: integer(
        service.maximum_delay_ms,
        DEFAULTS.service.maximumDelayMs,
        1_000,
        86_400_000,
      ),
      maximumRetryAfterMs: integer(
        service.maximum_retry_after_ms,
        DEFAULTS.service.maximumRetryAfterMs,
        1_000,
        86_400_000,
      ),
      detailedHistoryDays: integer(
        service.detailed_history_days,
        DEFAULTS.service.detailedHistoryDays,
        1,
        3_650,
      ),
      deadLetterDays: integer(service.dead_letter_days, DEFAULTS.service.deadLetterDays, 1, 3_650),
      auditDays: integer(service.audit_days, DEFAULTS.service.auditDays, 1, 3_650),
      outboxDays: integer(service.outbox_days, DEFAULTS.service.outboxDays, 1, 3_650),
    },
    database: {
      urlEnv: text(database.url_env, DEFAULTS.database.urlEnv),
      maxConnections: integer(database.max_connections, DEFAULTS.database.maxConnections, 1, 64),
    },
    kms: {
      provider: text(kms.provider, DEFAULTS.kms.provider),
      keyringPathEnv: text(kms.keyring_path_env, DEFAULTS.kms.keyringPathEnv),
    },
    identity: {
      defaultTenantId: text(identity.default_tenant_id, DEFAULTS.identity.defaultTenantId),
      requestsPerMinute: integer(
        identity.requests_per_minute,
        DEFAULTS.identity.requestsPerMinute,
        1,
        100_000,
      ),
      operatorSubjects: list(identity.operator_subjects),
      operatorRole: text(identity.operator_role, DEFAULTS.identity.operatorRole),
      deniedPlans: list(identity.denied_plans),
      tenantOverrides: map(identity.tenant_overrides),
      mysqlHost: text(identity.mysql_host, DEFAULTS.identity.mysqlHost),
      mysqlPort: integer(identity.mysql_port, DEFAULTS.identity.mysqlPort, 1, 65_535),
      mysqlUser: text(identity.mysql_user, DEFAULTS.identity.mysqlUser),
      mysqlDatabase: text(identity.mysql_database, DEFAULTS.identity.mysqlDatabase),
      mysqlPasswordEnv: text(identity.mysql_password_env, DEFAULTS.identity.mysqlPasswordEnv),
      keycloakJwksUrl: text(identity.keycloak_jwks_url, DEFAULTS.identity.keycloakJwksUrl),
      keycloakIssuers: list(identity.keycloak_issuers),
      keycloakAudiences: list(identity.keycloak_audiences),
    },
    egress: {
      requireHttps: flag(egress.require_https, DEFAULTS.egress.requireHttps),
      allowedPorts: list(egress.allowed_ports)
        .map(Number)
        .filter((port) => Number.isInteger(port) && port > 0 && port < 65_536),
    },
  };
}

export function requiredEnvironment(name: string, environment = process.env): string {
  const value = environment[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

type YamlValue = string | YamlValue[] | { [key: string]: YamlValue };

function section(document: Record<string, YamlValue>, name: string): Record<string, YamlValue> {
  const value = document[name];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function text(value: YamlValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function integer(value: YamlValue | undefined, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function flag(value: YamlValue | undefined, fallback: boolean): boolean {
  if (typeof value !== 'string') return fallback;
  if (['true', 'yes', 'on', '1'].includes(value.toLowerCase())) return true;
  if (['false', 'no', 'off', '0'].includes(value.toLowerCase())) return false;
  return fallback;
}

function list(value: YamlValue | undefined): string[] {
  if (Array.isArray(value))
    return value.filter((entry): entry is string => typeof entry === 'string');
  if (typeof value === 'string' && value.length > 0)
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  return [];
}

function map(value: YamlValue | undefined): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value))
    if (typeof entry === 'string') result[key] = entry;
  return result;
}

/**
 * Parses the deliberately small YAML subset used by the deployment template:
 * nested mappings with two-space indentation, scalar values, inline `[a, b]`
 * sequences, `- item` sequences, comments, and blank lines. Anything else is
 * rejected so a malformed file fails at start-up instead of silently changing
 * production behavior.
 */
export function parseSimpleYaml(source: string): Record<string, YamlValue> {
  const lines: Array<{ indent: number; text: string; number: number }> = [];
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const withoutComment = stripComment(raw);
    if (withoutComment.trim().length === 0) continue;
    lines.push({
      indent: withoutComment.length - withoutComment.trimStart().length,
      text: withoutComment.trim(),
      number: index + 1,
    });
  }
  const cursor = { index: 0 };
  const parsed = parseBlock(lines, cursor, lines[0]?.indent ?? 0);
  if (cursor.index < lines.length)
    throw new Error(`invalid configuration indentation on line ${lines[cursor.index]?.number}`);
  return Array.isArray(parsed) ? {} : parsed;
}

function parseBlock(
  lines: ReadonlyArray<{ indent: number; text: string; number: number }>,
  cursor: { index: number },
  indent: number,
): Record<string, YamlValue> | YamlValue[] {
  const mapping: Record<string, YamlValue> = {};
  const items: YamlValue[] = [];
  let isSequence = false;
  while (cursor.index < lines.length) {
    const line = lines[cursor.index] as { indent: number; text: string; number: number };
    if (line.indent < indent) break;
    if (line.indent > indent)
      throw new Error(`invalid configuration indentation on line ${line.number}`);
    if (line.text.startsWith('- ')) {
      isSequence = true;
      items.push(scalar(line.text.slice(2).trim()));
      cursor.index += 1;
      continue;
    }
    const separator = line.text.indexOf(':');
    if (separator < 1) throw new Error(`invalid configuration syntax on line ${line.number}`);
    const key = line.text.slice(0, separator).trim();
    const value = line.text.slice(separator + 1).trim();
    cursor.index += 1;
    if (value.length > 0) {
      mapping[key] = scalar(value);
      continue;
    }
    const next = lines[cursor.index];
    mapping[key] = next && next.indent > indent ? parseBlock(lines, cursor, next.indent) : {};
  }
  return isSequence ? items : mapping;
}

function stripComment(line: string): string {
  let quoted: string | undefined;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index] as string;
    if (quoted) {
      if (character === quoted) quoted = undefined;
      continue;
    }
    if (character === '"' || character === "'") quoted = character;
    else if (character === '#' && (index === 0 || line[index - 1] === ' '))
      return line.slice(0, index);
  }
  return line;
}

function scalar(value: string): YamlValue {
  if (value.startsWith('[') && value.endsWith(']')) {
    const inner = value.slice(1, -1).trim();
    if (inner.length === 0) return [];
    return inner.split(',').map((entry) => unquote(entry.trim()));
  }
  return unquote(value);
}

function unquote(value: string): string {
  if (
    value.length >= 2 &&
    (value.startsWith('"') || value.startsWith("'")) &&
    value.at(-1) === value[0]
  )
    return value.slice(1, -1);
  return value;
}
