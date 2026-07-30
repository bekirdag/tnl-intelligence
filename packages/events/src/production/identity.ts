/**
 * Production identity and tenant authorization for the webhook control API.
 *
 * Two credential shapes are accepted on `Authorization: Bearer`:
 *   - a TNL API key, verified against the member key directory by SHA-256 hash;
 *   - a Keycloak access token, verified against the realm JWKS.
 *
 * Both resolve to a `SubscriptionActor` whose tenant comes from server-side
 * mapping, never from the request, so a caller cannot select another tenant.
 */
import { createHash, createPublicKey, createVerify } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { ControlAuthenticator } from '../server.js';
import { SubscriptionError, type SubscriptionActor } from '../subscriptions.js';

export interface MemberKeyRecord {
  id: string;
  ownerSub: string;
  planSlug: string;
  emailVerifiedAt: string | null;
}

/** The member API-key directory owned by the main TNL application. */
export interface MemberKeyDirectory {
  findByHash(keyHash: string): Promise<MemberKeyRecord | undefined>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}

export interface MysqlMemberDirectoryOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit?: number;
}

interface MysqlPool {
  execute(sql: string, values?: readonly unknown[]): Promise<[unknown[], unknown]>;
  query(sql: string): Promise<unknown>;
  end(): Promise<void>;
}

/**
 * Reads `member_api_keys` directly, using the same hash and revocation rules as
 * the TNL API, so a key that works for the API works for webhooks and a revoked
 * key stops working everywhere at the same moment.
 */
export class MysqlMemberKeyDirectory implements MemberKeyDirectory {
  #pool: MysqlPool | undefined;

  private constructor(pool: MysqlPool) {
    this.#pool = pool;
  }

  static async connect(options: MysqlMemberDirectoryOptions): Promise<MysqlMemberKeyDirectory> {
    const driver = (await import(/* webpackIgnore: true */ 'mysql2/promise' as string)) as {
      default?: { createPool: (config: Record<string, unknown>) => MysqlPool };
      createPool?: (config: Record<string, unknown>) => MysqlPool;
    };
    const createPool = driver.createPool ?? driver.default?.createPool;
    if (!createPool) throw new Error('the mysql2 driver does not expose createPool');
    return new MysqlMemberKeyDirectory(
      createPool({
        host: options.host,
        port: options.port,
        user: options.user,
        password: options.password,
        database: options.database,
        connectionLimit: options.connectionLimit ?? 4,
        waitForConnections: true,
        timezone: 'Z',
      }),
    );
  }

  async findByHash(keyHash: string): Promise<MemberKeyRecord | undefined> {
    if (!this.#pool) throw new Error('member key directory is closed');
    const [rows] = await this.#pool.execute(
      `SELECT id, owner_sub, plan_slug, email_verified_at
       FROM member_api_keys
       WHERE key_hash = ? AND revoked_at IS NULL
       LIMIT 1`,
      [keyHash],
    );
    const row = (rows as Array<Record<string, unknown>>)[0];
    if (!row) return undefined;
    return {
      id: String(row.id),
      ownerSub: String(row.owner_sub),
      planSlug: String(row.plan_slug ?? 'free'),
      emailVerifiedAt: row.email_verified_at ? String(row.email_verified_at) : null,
    };
  }

  async health(): Promise<boolean> {
    try {
      await this.#pool?.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    const pool = this.#pool;
    this.#pool = undefined;
    await pool?.end();
  }
}

export interface KeycloakVerifierOptions {
  jwksUrl: string;
  issuers: readonly string[];
  audiences: readonly string[];
  operatorRole?: string;
  cacheMs?: number;
}

interface Jwk {
  kid?: string;
  alg?: string;
  use?: string;
  kty?: string;
}

/** Minimal RS256 access-token verifier for the TNL Keycloak realm. */
export class KeycloakTokenVerifier {
  #cache: { keys: Jwk[]; expiresAt: number } | undefined;

  constructor(private readonly options: KeycloakVerifierOptions) {}

  async verify(token: string): Promise<{ subject: string; roles: string[] }> {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
    if (!encodedHeader || !encodedPayload || !encodedSignature)
      throw new SubscriptionError('invalid_token', 401);
    const header = decodeSegment(encodedHeader);
    const payload = decodeSegment(encodedPayload);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string')
      throw new SubscriptionError('invalid_token', 401);
    let jwk = (await this.keys(false)).find((entry) => entry.kid === header.kid);
    if (!jwk) jwk = (await this.keys(true)).find((entry) => entry.kid === header.kid);
    if (!jwk) throw new SubscriptionError('invalid_token', 401);
    const verifier = createVerify('RSA-SHA256');
    verifier.update(`${encodedHeader}.${encodedPayload}`);
    verifier.end();
    const key = createPublicKey({ key: jwk as never, format: 'jwk' });
    if (!verifier.verify(key, Buffer.from(encodedSignature, 'base64url')))
      throw new SubscriptionError('invalid_token', 401);
    const now = Math.floor(Date.now() / 1_000);
    const expiry = Number(payload.exp);
    if (!Number.isFinite(expiry) || expiry <= now)
      throw new SubscriptionError('invalid_token', 401);
    const issuer = String(payload.iss ?? '').replace(/\/+$/, '');
    if (!this.options.issuers.includes(issuer)) throw new SubscriptionError('invalid_token', 401);
    const audiences = Array.isArray(payload.aud)
      ? payload.aud.map(String)
      : [String(payload.aud ?? '')];
    if (
      this.options.audiences.length > 0 &&
      !audiences.some((value) => this.options.audiences.includes(value))
    )
      throw new SubscriptionError('invalid_token', 401);
    const subject = String(payload.sub ?? '');
    if (!subject) throw new SubscriptionError('invalid_token', 401);
    const realmAccess = payload.realm_access as { roles?: unknown } | undefined;
    const roles = Array.isArray(realmAccess?.roles) ? realmAccess.roles.map(String) : [];
    return { subject, roles };
  }

  async health(): Promise<boolean> {
    try {
      return (await this.keys(false)).length > 0;
    } catch {
      return false;
    }
  }

  private async keys(force: boolean): Promise<Jwk[]> {
    if (!force && this.#cache && this.#cache.expiresAt > Date.now()) return this.#cache.keys;
    const response = await fetch(this.options.jwksUrl, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('jwks_unavailable');
    const document = (await response.json()) as { keys?: unknown };
    const keys = Array.isArray(document.keys) ? (document.keys as Jwk[]) : [];
    if (keys.length === 0) throw new Error('jwks_empty');
    this.#cache = { keys, expiresAt: Date.now() + (this.options.cacheMs ?? 600_000) };
    return keys;
  }
}

function decodeSegment(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, unknown>;
  } catch {
    // Fall through to a generic authentication failure.
  }
  throw new SubscriptionError('invalid_token', 401);
}

export interface TnlIdentityOptions {
  directory: MemberKeyDirectory;
  keycloak?: KeycloakTokenVerifier;
  /** Tenant used for every principal without an explicit override. */
  defaultTenantId: string;
  /** Owner subject to tenant overrides for dedicated-tenant customers. */
  tenantOverrides?: Readonly<Record<string, string>>;
  /** Owner subjects allowed to replay deliveries. */
  operatorSubjects?: readonly string[];
  /** Keycloak realm role that grants replay authority. */
  operatorRole?: string;
  /** Plans that may not create webhook subscriptions at all. */
  deniedPlans?: readonly string[];
  requestsPerMinute?: number;
  now?: () => number;
}

/**
 * Authenticates control-plane requests and applies per-principal rate limits.
 * Endpoint creation, verification, replay, and test events all flow through the
 * same authenticator, so the limit covers every mutating action.
 */
export class TnlControlAuthenticator implements ControlAuthenticator {
  readonly #buckets = new Map<string, { windowStart: number; count: number }>();
  readonly #now: () => number;

  constructor(private readonly options: TnlIdentityOptions) {
    this.#now = options.now ?? Date.now;
  }

  async authenticate(request: IncomingMessage): Promise<SubscriptionActor> {
    const token = bearer(request);
    const actor =
      token.split('.').length === 3 ? await this.fromJwt(token) : await this.fromKey(token);
    this.consume(actor.ownerId);
    return actor;
  }

  async health(): Promise<boolean> {
    const directory = await this.options.directory.health();
    if (!directory) return false;
    return this.options.keycloak ? this.options.keycloak.health() : true;
  }

  private async fromKey(token: string): Promise<SubscriptionActor> {
    const hash = createHash('sha256').update(token).digest('hex');
    const record = await this.options.directory.findByHash(hash);
    if (!record) throw new SubscriptionError('authentication_required', 401);
    if (record.planSlug === 'free' && !record.emailVerifiedAt)
      throw new SubscriptionError('email_verification_required', 403);
    if (this.options.deniedPlans?.includes(record.planSlug))
      throw new SubscriptionError('plan_not_entitled', 403);
    return this.actor(record.ownerSub, []);
  }

  private async fromJwt(token: string): Promise<SubscriptionActor> {
    if (!this.options.keycloak) throw new SubscriptionError('authentication_required', 401);
    const verified = await this.options.keycloak.verify(token);
    return this.actor(verified.subject, verified.roles);
  }

  private actor(ownerSub: string, roles: readonly string[]): SubscriptionActor {
    const tenantId = this.options.tenantOverrides?.[ownerSub] ?? this.options.defaultTenantId;
    const operatorRole = this.options.operatorRole;
    const canReplay =
      (this.options.operatorSubjects ?? []).includes(ownerSub) ||
      (operatorRole !== undefined && roles.includes(operatorRole));
    return { ownerId: ownerSub, tenantId, ...(canReplay ? { canReplay: true } : {}) };
  }

  private consume(ownerId: string): void {
    const limit = this.options.requestsPerMinute ?? 120;
    const now = this.#now();
    const window = Math.floor(now / 60_000);
    const bucket = this.#buckets.get(ownerId);
    if (!bucket || bucket.windowStart !== window) {
      this.#buckets.set(ownerId, { windowStart: window, count: 1 });
      if (this.#buckets.size > 10_000) {
        for (const [key, value] of this.#buckets)
          if (value.windowStart !== window) this.#buckets.delete(key);
      }
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) throw new SubscriptionError('rate_limited', 429);
  }
}

function bearer(request: IncomingMessage): string {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || header.length > 8_192)
    throw new SubscriptionError('authentication_required', 401);
  if (header.slice(0, 7).toLowerCase() !== 'bearer ')
    throw new SubscriptionError('authentication_required', 401);
  const token = header.slice(7).trim();
  if (!token || token.length > 4_096) throw new SubscriptionError('authentication_required', 401);
  return token;
}
