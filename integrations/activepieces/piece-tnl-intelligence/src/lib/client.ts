import { HttpError, HttpMethod, httpClient, type HttpHeaders } from '@activepieces/pieces-common';

const API_BASE_URL = 'https://theneuralledger.com';
const MCP_URL = 'https://mcp.theneuralledger.com/mcp';
const REQUEST_TIMEOUT_MS = 45_000;
const MAX_TEXT_LENGTH = 1_000;
const MAX_CURSOR_LENGTH = 4_096;
const MAX_PAGE_SIZE = 100;

class TnlPieceError extends Error {}

class TnlPieceClient {
  private readonly apiKey: string;
  private readonly transport: TnlTransport;

  constructor(options: TnlClientOptions) {
    this.apiKey = requiredText(options.apiKey, 'TNL API key', 512);
    this.transport = options.transport ?? defaultTransport;
  }

  async validateCredentials(): Promise<void> {
    await this.apiGet('/v1/me');
  }

  async searchIntelligence(values: SearchValues): Promise<JsonObject> {
    return this.apiGet('/v1/search', {
      q: requiredText(values.query, 'query'),
      page_size: pageSize(values.pageSize),
      cursor: optionalText(values.cursor, 'cursor', MAX_CURSOR_LENGTH),
      include: values.includeBody ? 'sources,claims,body' : 'sources,claims',
    });
  }

  async getIntelligence(values: GetValues): Promise<JsonObject> {
    const identifier = requiredText(values.id, 'id', 300);
    return this.apiGet(`/v1/news/${encodeURIComponent(identifier)}`, {
      include: values.includeBody ? 'sources,claims,body' : 'sources,claims',
    });
  }

  async listRecentChanges(values: RecentValues): Promise<JsonObject> {
    return this.apiGet('/v1/news', {
      updated_since: isoTimestamp(values.since, 'since', true),
      page_size: pageSize(values.pageSize),
      cursor: optionalText(values.cursor, 'cursor', MAX_CURSOR_LENGTH),
      sort: 'pipeline',
      include: 'sources,claims',
    });
  }

  async getExposure(values: ExposureValues): Promise<JsonObject> {
    const resources: Record<ExposureKind, string> = {
      entity: 'entities',
      asset: 'assets',
      impact_path: 'impact-paths',
    };
    if (!isExposureKind(values.kind)) {
      throw new TnlPieceError('kind must be entity, asset, or impact_path.');
    }
    const resource = resources[values.kind];
    const identifier = requiredText(values.value, 'value', 300);
    return this.apiGet(`/v1/${resource}/${encodeURIComponent(identifier)}/stories`, {
      page_size: pageSize(values.pageSize),
      cursor: optionalText(values.cursor, 'cursor', MAX_CURSOR_LENGTH),
      include: 'sources,claims',
    });
  }

  async runResearch(values: ResearchValues): Promise<JsonObject> {
    const mappings: Record<ResearchWorkflow, ResearchMapping> = {
      'what-changed': {
        tool: 'tnl_research_what_changed',
        questionKey: 'query',
      },
      'compare-sources': {
        tool: 'tnl_research_compare_sources',
        questionKey: 'query',
      },
      'validate-event': {
        tool: 'tnl_research_validate_event',
        questionKey: 'event',
      },
      'asset-exposure': {
        tool: 'tnl_research_asset_exposure',
        questionKey: 'assetName',
      },
      'operational-risk': {
        tool: 'tnl_research_operational_risk',
        questionKey: 'query',
      },
      'weekly-consequential': {
        tool: 'tnl_research_weekly_consequential',
        questionKey: 'query',
      },
    };
    if (!isResearchWorkflow(values.workflow)) {
      throw new TnlPieceError('workflow is not supported.');
    }
    const mapping = mappings[values.workflow];
    return this.callMcpTool(mapping.tool, {
      [mapping.questionKey]: requiredText(values.question, 'question'),
      from: isoTimestamp(values.from, 'from'),
      to: isoTimestamp(values.to, 'to'),
      limit: pageSize(values.limit),
    });
  }

  async getWeeklyEdition(values: WeeklyValues): Promise<JsonObject> {
    const endingText = isoTimestamp(values.weekEnding, 'week_ending') ?? new Date().toISOString();
    const ending = new Date(endingText);
    const weekStart = new Date(ending.getTime() - 7 * 86_400_000).toISOString();
    const filters = [
      optionalText(values.category, 'category', 200),
      optionalText(values.geography, 'geography', 200),
    ].filter((value): value is string => Boolean(value));
    const focus = filters.length > 0 ? ` Focus on: ${filters.join(', ')}.` : '';
    return this.callMcpTool('tnl_research_weekly_consequential', {
      query: `What were the most consequential developments in this period?${focus}`,
      weekStart,
      limit: pageSize(values.limit),
    });
  }

  private async apiGet(path: string, queryParams: QueryParams = {}): Promise<JsonObject> {
    const response = await this.request({
      method: 'GET',
      url: `${API_BASE_URL}${path}`,
      headers: this.apiHeaders(),
      queryParams: compactQuery(queryParams),
      responseType: 'json',
    });
    return jsonObject(response.body, 'TNL returned an invalid JSON response.');
  }

  private async callMcpTool(name: string, argumentsValue: JsonObject): Promise<JsonObject> {
    const baseHeaders = {
      ...this.apiHeaders(),
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    };
    const initialized = await this.mcpRequest(baseHeaders, {
      jsonrpc: '2.0',
      id: 'activepieces-initialize',
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: {
          name: 'tnl-intelligence-activepieces',
          version: '0.1.0',
        },
      },
    });
    const sessionId = headerValue(initialized.headers, 'mcp-session-id');
    const headers = sessionId ? { ...baseHeaders, 'MCP-Session-Id': sessionId } : baseHeaders;
    try {
      await this.mcpRequest(
        headers,
        {
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        },
        false,
      );
      const called = await this.mcpRequest(headers, {
        jsonrpc: '2.0',
        id: 'activepieces-tools-call',
        method: 'tools/call',
        params: {
          name,
          arguments: compactObject(argumentsValue),
        },
      });
      const payload = mcpPayload(called.body);
      const result = jsonObject(payload.result, 'TNL research returned an invalid result.');
      if (result.isError === true) {
        throw new TnlPieceError('TNL research failed. Review the inputs and account scope.');
      }
      if (isJsonObject(result.structuredContent)) {
        return result.structuredContent;
      }
      const text = mcpText(result);
      if (!text) {
        throw new TnlPieceError('TNL research returned an empty result.');
      }
      const parsed = parseJson(text);
      return isJsonObject(parsed) ? parsed : { result: isJsonValue(parsed) ? parsed : text };
    } finally {
      if (sessionId) {
        await this.request({
          method: 'DELETE',
          url: MCP_URL,
          headers,
          responseType: 'text',
        }).catch(() => undefined);
      }
    }
  }

  private async mcpRequest(
    headers: Record<string, string>,
    body: JsonObject,
    expectPayload = true,
  ): Promise<TnlResponse> {
    const response = await this.request({
      method: 'POST',
      url: MCP_URL,
      headers,
      body,
      responseType: 'text',
    });
    if (expectPayload) {
      const payload = mcpPayload(response.body);
      if (isJsonObject(payload.error)) {
        throw new TnlPieceError('TNL MCP rejected the research request.');
      }
    }
    return response;
  }

  private async request(request: TnlRequest): Promise<TnlResponse> {
    try {
      return await this.transport(request);
    } catch (error) {
      if (error instanceof TnlPieceError) {
        throw error;
      }
      if (error instanceof HttpError) {
        throw statusError(error.response.status);
      }
      throw new TnlPieceError('TNL is temporarily unavailable. Try again.');
    }
  }

  private apiHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
      'User-Agent': 'tnl-intelligence-activepieces/0.1.0',
    };
  }
}

async function defaultTransport(request: TnlRequest): Promise<TnlResponse> {
  const response = await httpClient.sendRequest({
    method: httpMethod(request.method),
    url: request.url,
    headers: request.headers,
    queryParams: request.queryParams,
    body: request.body,
    responseType: request.responseType,
    timeout: REQUEST_TIMEOUT_MS,
    followRedirects: false,
  });
  return {
    status: response.status,
    headers: response.headers ?? {},
    body: response.body,
  };
}

function httpMethod(method: TnlMethod): HttpMethod {
  switch (method) {
    case 'GET':
      return HttpMethod.GET;
    case 'POST':
      return HttpMethod.POST;
    case 'DELETE':
      return HttpMethod.DELETE;
  }
}

function statusError(status: number): TnlPieceError {
  if (status === 401 || status === 403) {
    return new TnlPieceError('The TNL API key is invalid or lacks the required scope.');
  }
  if (status === 404) {
    return new TnlPieceError('The requested TNL resource was not found.');
  }
  if (status === 429) {
    return new TnlPieceError('The TNL request limit has been reached. Try again later.');
  }
  if (status >= 500) {
    return new TnlPieceError('TNL is temporarily unavailable. Try again.');
  }
  return new TnlPieceError(`TNL rejected the request with HTTP ${status}.`);
}

function requiredText(value: unknown, name: string, maximum = MAX_TEXT_LENGTH): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TnlPieceError(`${name} is required.`);
  }
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new TnlPieceError(`${name} is too long.`);
  }
  return normalized;
}

function optionalText(value: unknown, name: string, maximum = MAX_TEXT_LENGTH): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return requiredText(value, name, maximum);
}

function pageSize(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return 20;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new TnlPieceError('page size must be a number from 1 to 100.');
  }
  return value;
}

function isoTimestamp(value: unknown, name: string, required = false): string | undefined {
  const text = required ? requiredText(value, name) : optionalText(value, name);
  if (text === undefined) {
    return undefined;
  }
  if (!Number.isFinite(Date.parse(text))) {
    throw new TnlPieceError(`${name} must be an ISO 8601 date or timestamp.`);
  }
  return new Date(text).toISOString();
}

function compactQuery(values: QueryParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry): entry is [string, string | number | boolean] => {
        const value = entry[1];
        return value !== undefined && value !== null && value !== '';
      })
      .map(([key, value]) => [key, String(value)]),
  );
}

function compactObject(values: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => {
      return value !== undefined && value !== null && value !== '';
    }),
  );
}

function jsonObject(value: unknown, message: string): JsonObject {
  if (!isJsonObject(value)) {
    throw new TnlPieceError(message);
  }
  return value;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (isJsonObject(value)) {
    return Object.values(value).every((item) => item === undefined || isJsonValue(item));
  }
  return false;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function mcpPayload(body: unknown): JsonObject {
  let text =
    typeof body === 'string'
      ? body.trim()
      : JSON.stringify(jsonObject(body, 'TNL MCP returned an invalid response.'));
  if (text.startsWith('event:') || text.includes('\ndata:')) {
    const dataLines = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());
    const latest = dataLines.at(-1);
    if (!latest) {
      throw new TnlPieceError('TNL MCP returned an invalid event stream.');
    }
    text = latest;
  }
  return jsonObject(parseJson(text), 'TNL MCP returned an invalid JSON response.');
}

function mcpText(result: JsonObject): string {
  if (!Array.isArray(result.content)) {
    return '';
  }
  return result.content
    .filter(isJsonObject)
    .map((item) => (typeof item.text === 'string' ? item.text : ''))
    .filter(Boolean)
    .join('\n');
}

function headerValue(headers: HttpHeaders, name: string): string | undefined {
  const value = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function isExposureKind(value: unknown): value is ExposureKind {
  return value === 'entity' || value === 'asset' || value === 'impact_path';
}

function isResearchWorkflow(value: unknown): value is ResearchWorkflow {
  return (
    value === 'what-changed' ||
    value === 'compare-sources' ||
    value === 'validate-event' ||
    value === 'asset-exposure' ||
    value === 'operational-risk' ||
    value === 'weekly-consequential'
  );
}

export const tnlClient = {
  create: (options: TnlClientOptions) => new TnlPieceClient(options),
};

export type TnlTransport = (request: TnlRequest) => Promise<TnlResponse>;
export type ExposureKind = 'entity' | 'asset' | 'impact_path';
export type ResearchWorkflow =
  | 'what-changed'
  | 'compare-sources'
  | 'validate-event'
  | 'asset-exposure'
  | 'operational-risk'
  | 'weekly-consequential';

type TnlMethod = 'GET' | 'POST' | 'DELETE';
type TnlResponseType = 'json' | 'text';
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue | undefined };
type QueryParams = {
  [key: string]: string | number | boolean | null | undefined;
};
type TnlRequest = {
  method: TnlMethod;
  url: string;
  headers: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: JsonObject;
  responseType: TnlResponseType;
};
type TnlResponse = {
  status: number;
  headers: HttpHeaders;
  body: unknown;
};
type TnlClientOptions = {
  apiKey: string;
  transport?: TnlTransport;
};
type SearchValues = {
  query: unknown;
  pageSize?: unknown;
  cursor?: unknown;
  includeBody?: boolean;
};
type GetValues = {
  id: unknown;
  includeBody?: boolean;
};
type RecentValues = {
  since: unknown;
  pageSize?: unknown;
  cursor?: unknown;
};
type ExposureValues = {
  kind: unknown;
  value: unknown;
  pageSize?: unknown;
  cursor?: unknown;
};
type ResearchValues = {
  workflow: unknown;
  question: unknown;
  from?: unknown;
  to?: unknown;
  limit?: unknown;
};
type WeeklyValues = {
  weekEnding?: unknown;
  category?: unknown;
  geography?: unknown;
  limit?: unknown;
};
type ResearchMapping = {
  tool: string;
  questionKey: string;
};
