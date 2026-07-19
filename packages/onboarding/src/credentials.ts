import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';

export const DEVELOPER_SCOPES = ['news:read', 'research:read', 'mcp:read'] as const;
export type DeveloperScope = (typeof DEVELOPER_SCOPES)[number];

export interface CredentialRecord {
  id: string;
  ownerId: string;
  tenantId: string;
  name: string;
  prefix: string;
  verifier: string;
  salt: string;
  scopes: readonly DeveloperScope[];
  status: 'active' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  rotatedFromId?: string;
  rotatedToId?: string;
}

export interface CredentialMetadata extends Omit<CredentialRecord, 'verifier' | 'salt'> {}

export interface IssuedCredential {
  secret: string;
  credential: CredentialMetadata;
}

export interface CredentialAuditEvent {
  type: 'created' | 'rotated' | 'revoked' | 'deleted' | 'authenticated' | 'account_deleted';
  credentialId?: string;
  ownerId: string;
  tenantId: string;
  timestamp: string;
  reason: string;
}

export interface CredentialAuditSink {
  emit(event: CredentialAuditEvent): Promise<void>;
}

export interface CredentialStore {
  save(record: CredentialRecord): Promise<void>;
  get(id: string): Promise<CredentialRecord | undefined>;
  findByPrefix(prefix: string): Promise<CredentialRecord | undefined>;
  list(ownerId: string, tenantId: string): Promise<CredentialRecord[]>;
  delete(id: string): Promise<void>;
}

export interface CredentialCreationLimiter {
  consume(ownerId: string, tenantId: string, now: number, limit: number): Promise<boolean>;
}

export interface CredentialActor {
  ownerId: string;
  tenantId: string;
  recentAuthenticationAt: number;
}

export interface CredentialPolicy {
  maxActiveKeys: number;
  maxLifetimeDays: number;
  maxCreatesPerDay: number;
  recentAuthenticationMs: number;
}

const DEFAULT_POLICY: CredentialPolicy = {
  maxActiveKeys: 5,
  maxLifetimeDays: 90,
  maxCreatesPerDay: 5,
  recentAuthenticationMs: 5 * 60_000,
};

export class InMemoryCredentialStore implements CredentialStore {
  readonly records = new Map<string, CredentialRecord>();

  async save(record: CredentialRecord): Promise<void> {
    this.records.set(record.id, structuredClone(record));
  }

  async get(id: string): Promise<CredentialRecord | undefined> {
    const record = this.records.get(id);
    return record ? structuredClone(record) : undefined;
  }

  async findByPrefix(prefix: string): Promise<CredentialRecord | undefined> {
    const record = [...this.records.values()].find((candidate) => candidate.prefix === prefix);
    return record ? structuredClone(record) : undefined;
  }

  async list(ownerId: string, tenantId: string): Promise<CredentialRecord[]> {
    return [...this.records.values()]
      .filter((record) => record.ownerId === ownerId && record.tenantId === tenantId)
      .map((record) => structuredClone(record));
  }

  async delete(id: string): Promise<void> {
    this.records.delete(id);
  }
}

export class MemoryCredentialAuditSink implements CredentialAuditSink {
  readonly events: CredentialAuditEvent[] = [];

  async emit(event: CredentialAuditEvent): Promise<void> {
    this.events.push(structuredClone(event));
  }
}

export class InMemoryCredentialCreationLimiter implements CredentialCreationLimiter {
  readonly #counts = new Map<string, number>();

  async consume(ownerId: string, tenantId: string, now: number, limit: number): Promise<boolean> {
    const day = new Date(now).toISOString().slice(0, 10);
    const key = `${ownerId}\u0000${tenantId}\u0000${day}`;
    const count = this.#counts.get(key) ?? 0;
    if (count >= limit) return false;
    this.#counts.set(key, count + 1);
    return true;
  }
}

export class CredentialService {
  readonly #store: CredentialStore;
  readonly #audit: CredentialAuditSink;
  readonly #policy: CredentialPolicy;
  readonly #now: () => number;
  readonly #creationLimiter: CredentialCreationLimiter;

  constructor(options: {
    store: CredentialStore;
    audit: CredentialAuditSink;
    policy?: Partial<CredentialPolicy>;
    now?: () => number;
    creationLimiter?: CredentialCreationLimiter;
  }) {
    this.#store = options.store;
    this.#audit = options.audit;
    this.#policy = { ...DEFAULT_POLICY, ...options.policy };
    this.#now = options.now ?? Date.now;
    this.#creationLimiter = options.creationLimiter ?? new InMemoryCredentialCreationLimiter();
  }

  async create(
    actor: CredentialActor,
    input: { name: string; scopes: readonly DeveloperScope[]; lifetimeDays?: number },
  ): Promise<IssuedCredential> {
    const records = await this.#store.list(actor.ownerId, actor.tenantId);
    const now = this.#now();
    const active = records.filter((record) => status(record, now) === 'active');
    if (active.length >= this.#policy.maxActiveKeys) throw new CredentialError('key_limit', 409);
    if (
      !(await this.#creationLimiter.consume(
        actor.ownerId,
        actor.tenantId,
        now,
        this.#policy.maxCreatesPerDay,
      ))
    )
      throw new CredentialError('create_rate', 429);
    const issued = issue(actor, input, now, this.#policy.maxLifetimeDays);
    await this.#store.save(issued.record);
    await this.#audit.emit(audit('created', actor, now, 'user_created', issued.record.id));
    return { secret: issued.secret, credential: metadata(issued.record, now) };
  }

  async list(actor: CredentialActor): Promise<CredentialMetadata[]> {
    const now = this.#now();
    return (await this.#store.list(actor.ownerId, actor.tenantId))
      .map((record) => metadata(record, now))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async authenticate(secret: string): Promise<CredentialMetadata> {
    const parsed = parseSecret(secret);
    const record = await this.#store.findByPrefix(parsed.prefix);
    const now = this.#now();
    if (!record || status(record, now) !== 'active' || !verify(parsed.secret, record)) {
      throw new CredentialError('invalid_key', 401);
    }
    record.lastUsedAt = new Date(now).toISOString();
    await this.#store.save(record);
    await this.#audit.emit(
      audit('authenticated', actorFrom(record, now), now, 'key_authenticated', record.id),
    );
    return metadata(record, now);
  }

  async rotate(actor: CredentialActor, id: string): Promise<IssuedCredential> {
    requireRecent(actor, this.#now(), this.#policy.recentAuthenticationMs);
    const previous = await owned(this.#store, actor, id);
    if (status(previous, this.#now()) !== 'active') throw new CredentialError('not_active', 409);
    const now = this.#now();
    const issued = issue(
      actor,
      {
        name: previous.name,
        scopes: previous.scopes,
        lifetimeDays: Math.max(1, Math.ceil((Date.parse(previous.expiresAt) - now) / 86_400_000)),
      },
      now,
      this.#policy.maxLifetimeDays,
      previous.id,
    );
    previous.status = 'revoked';
    previous.revokedAt = new Date(now).toISOString();
    previous.rotatedToId = issued.record.id;
    await this.#store.save(previous);
    await this.#store.save(issued.record);
    await this.#audit.emit(audit('rotated', actor, now, 'user_rotated', issued.record.id));
    return { secret: issued.secret, credential: metadata(issued.record, now) };
  }

  async revoke(actor: CredentialActor, id: string): Promise<CredentialMetadata> {
    requireRecent(actor, this.#now(), this.#policy.recentAuthenticationMs);
    const record = await owned(this.#store, actor, id);
    const now = this.#now();
    if (status(record, now) === 'active') {
      record.status = 'revoked';
      record.revokedAt = new Date(now).toISOString();
      await this.#store.save(record);
    }
    await this.#audit.emit(audit('revoked', actor, now, 'user_revoked', record.id));
    return metadata(record, now);
  }

  async delete(actor: CredentialActor, id: string): Promise<void> {
    requireRecent(actor, this.#now(), this.#policy.recentAuthenticationMs);
    const record = await owned(this.#store, actor, id);
    await this.#store.delete(record.id);
    await this.#audit.emit(audit('deleted', actor, this.#now(), 'user_deleted', record.id));
  }

  async deleteAccount(actor: CredentialActor): Promise<void> {
    requireRecent(actor, this.#now(), this.#policy.recentAuthenticationMs);
    const records = await this.#store.list(actor.ownerId, actor.tenantId);
    await Promise.all(records.map((record) => this.#store.delete(record.id)));
    await this.#audit.emit(audit('account_deleted', actor, this.#now(), 'user_deleted_account'));
  }
}

export class CredentialError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'CredentialError';
  }
}

function issue(
  actor: CredentialActor,
  input: { name: string; scopes: readonly DeveloperScope[]; lifetimeDays?: number },
  now: number,
  maxLifetimeDays: number,
  rotatedFromId?: string,
): { secret: string; record: CredentialRecord } {
  const name = input.name.trim();
  if (!name || name.length > 80) throw new CredentialError('invalid_name', 400);
  const scopes = [...new Set(input.scopes)];
  if (
    scopes.length === 0 ||
    scopes.some((scope) => !(DEVELOPER_SCOPES as readonly string[]).includes(scope))
  ) {
    throw new CredentialError('invalid_scope', 400);
  }
  const lifetimeDays = Math.min(input.lifetimeDays ?? 30, maxLifetimeDays);
  if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1) {
    throw new CredentialError('invalid_lifetime', 400);
  }
  const prefix = randomBytes(6).toString('hex');
  const secretValue = randomBytes(32).toString('base64url');
  const salt = randomBytes(16).toString('base64url');
  const secret = `tnl_dev_${prefix}.${secretValue}`;
  const record: CredentialRecord = {
    id: randomUUID(),
    ownerId: actor.ownerId,
    tenantId: actor.tenantId,
    name,
    prefix,
    verifier: verifier(secretValue, salt),
    salt,
    scopes,
    status: 'active',
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + lifetimeDays * 86_400_000).toISOString(),
    ...(rotatedFromId ? { rotatedFromId } : {}),
  };
  return { secret, record };
}

function parseSecret(value: string): { prefix: string; secret: string } {
  const match = value.match(/^tnl_dev_([a-f0-9]{12})\.([A-Za-z0-9_-]{40,})$/);
  if (!match) throw new CredentialError('invalid_key', 401);
  return { prefix: match[1] as string, secret: match[2] as string };
}

function verifier(secret: string, salt: string): string {
  return scryptSync(secret, Buffer.from(salt, 'base64url'), 32).toString('base64url');
}

function verify(secret: string, record: CredentialRecord): boolean {
  const expected = Buffer.from(record.verifier, 'base64url');
  const actual = Buffer.from(verifier(secret, record.salt), 'base64url');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function metadata(record: CredentialRecord, now: number): CredentialMetadata {
  const { verifier: _verifier, salt: _salt, ...result } = record;
  return { ...result, status: status(record, now) };
}

function status(record: CredentialRecord, now: number): CredentialRecord['status'] {
  if (record.status === 'active' && Date.parse(record.expiresAt) <= now) return 'expired';
  return record.status;
}

async function owned(
  store: CredentialStore,
  actor: CredentialActor,
  id: string,
): Promise<CredentialRecord> {
  const record = await store.get(id);
  if (!record || record.ownerId !== actor.ownerId || record.tenantId !== actor.tenantId) {
    throw new CredentialError('not_found', 404);
  }
  return record;
}

function requireRecent(actor: CredentialActor, now: number, maximumAge: number): void {
  if (actor.recentAuthenticationAt > now || now - actor.recentAuthenticationAt > maximumAge) {
    throw new CredentialError('recent_authentication_required', 403);
  }
}

function actorFrom(record: CredentialRecord, now: number): CredentialActor {
  return { ownerId: record.ownerId, tenantId: record.tenantId, recentAuthenticationAt: now };
}

function audit(
  type: CredentialAuditEvent['type'],
  actor: CredentialActor,
  now: number,
  reason: string,
  credentialId?: string,
): CredentialAuditEvent {
  return {
    type,
    ownerId: actor.ownerId,
    tenantId: actor.tenantId,
    timestamp: new Date(now).toISOString(),
    reason,
    ...(credentialId ? { credentialId } : {}),
  };
}
