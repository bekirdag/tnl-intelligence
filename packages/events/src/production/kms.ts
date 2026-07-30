/**
 * KMS-backed secret protection for subscription signing keys.
 *
 * Signing secrets are sealed with a data key that only ever exists in plaintext
 * inside the service process. The data key itself is stored wrapped by a
 * key-management service, so the webhook database never contains material that
 * can decrypt a signing secret on its own. Rotating the KMS key adds a new data
 * key version; earlier versions stay unwrappable, so no row has to be rewritten.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { SecretProtector } from '../subscriptions.js';
import type { SqlPool } from './sql.js';

export interface WrappedDataKey {
  keyId: string;
  ciphertext: string;
}

/**
 * The narrow surface a key-management service must provide. A cloud KMS client
 * implements the same methods against its `Encrypt`/`Decrypt` API calls.
 */
export interface KeyManagementService {
  activeKeyId(): string;
  wrap(dataKey: Buffer): Promise<WrappedDataKey>;
  unwrap(wrapped: WrappedDataKey): Promise<Buffer>;
  health(): Promise<boolean>;
}

/** Durable storage for wrapped data keys, one per KMS key version. */
export interface WrappedKeyStore {
  load(): Promise<WrappedDataKey[]>;
  save(wrapped: WrappedDataKey): Promise<void>;
}

export class SecretProtectionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SecretProtectionError';
  }
}

interface KeyringEntry {
  id: string;
  material: Buffer;
}

/**
 * A key-management service whose master key material is delivered out of band
 * (systemd `LoadCredential`, a root-owned keyring file, or an HSM export) and is
 * never written to the webhook database. Key versions let the master key rotate
 * while previously wrapped data keys stay decryptable.
 */
export class LocalKeyManagementService implements KeyManagementService {
  readonly #keys: Map<string, Buffer>;
  readonly #activeKeyId: string;

  constructor(keys: readonly KeyringEntry[], activeKeyId?: string) {
    if (keys.length === 0) throw new SecretProtectionError('kms_keyring_empty');
    this.#keys = new Map();
    for (const key of keys) {
      if (!/^[a-z0-9][a-z0-9_-]{2,63}$/.test(key.id))
        throw new SecretProtectionError('kms_key_id_invalid');
      if (key.material.length !== 32) throw new SecretProtectionError('kms_key_length_invalid');
      this.#keys.set(key.id, Buffer.from(key.material));
    }
    const active = activeKeyId ?? (keys.at(-1) as KeyringEntry).id;
    if (!this.#keys.has(active)) throw new SecretProtectionError('kms_active_key_missing');
    this.#activeKeyId = active;
  }

  /**
   * Loads a JSON keyring of the shape
   * `{ "activeKeyId": "...", "keys": [{ "id": "...", "material": "<base64>" }] }`.
   */
  static async fromFile(path: string): Promise<LocalKeyManagementService> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(path, 'utf8'));
    } catch {
      throw new SecretProtectionError('kms_keyring_unreadable');
    }
    if (typeof parsed !== 'object' || parsed === null)
      throw new SecretProtectionError('kms_keyring_invalid');
    const document = parsed as { activeKeyId?: unknown; keys?: unknown };
    if (!Array.isArray(document.keys)) throw new SecretProtectionError('kms_keyring_invalid');
    const keys = document.keys.map((entry) => {
      const item = entry as { id?: unknown; material?: unknown };
      if (typeof item.id !== 'string' || typeof item.material !== 'string')
        throw new SecretProtectionError('kms_keyring_invalid');
      return { id: item.id, material: Buffer.from(item.material, 'base64') };
    });
    return new LocalKeyManagementService(
      keys,
      typeof document.activeKeyId === 'string' ? document.activeKeyId : undefined,
    );
  }

  activeKeyId(): string {
    return this.#activeKeyId;
  }

  async wrap(dataKey: Buffer): Promise<WrappedDataKey> {
    if (dataKey.length !== 32) throw new SecretProtectionError('kms_data_key_invalid');
    const key = this.#keys.get(this.#activeKeyId) as Buffer;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(this.#activeKeyId, 'utf8'));
    const sealed = Buffer.concat([cipher.update(dataKey), cipher.final()]);
    return {
      keyId: this.#activeKeyId,
      ciphertext: [
        iv.toString('base64url'),
        cipher.getAuthTag().toString('base64url'),
        sealed.toString('base64url'),
      ].join('.'),
    };
  }

  async unwrap(wrapped: WrappedDataKey): Promise<Buffer> {
    const key = this.#keys.get(wrapped.keyId);
    if (!key) throw new SecretProtectionError('kms_key_version_unknown');
    const parts = wrapped.ciphertext.split('.');
    if (parts.length !== 3) throw new SecretProtectionError('kms_ciphertext_malformed');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        key,
        Buffer.from(parts[0] as string, 'base64url'),
      );
      decipher.setAAD(Buffer.from(wrapped.keyId, 'utf8'));
      decipher.setAuthTag(Buffer.from(parts[1] as string, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(parts[2] as string, 'base64url')),
        decipher.final(),
      ]);
    } catch {
      throw new SecretProtectionError('kms_unwrap_failed');
    }
  }

  async health(): Promise<boolean> {
    try {
      const probe = randomBytes(32);
      const unwrapped = await this.unwrap(await this.wrap(probe));
      return unwrapped.length === probe.length && timingSafeEqual(unwrapped, probe);
    } catch {
      return false;
    }
  }
}

export const WRAPPED_KEY_SCHEMA = `CREATE TABLE IF NOT EXISTS webhook_data_keys (
  kms_key_id text PRIMARY KEY,
  wrapped_data_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
)`;

export class PostgresWrappedKeyStore implements WrappedKeyStore {
  constructor(private readonly pool: SqlPool) {}

  async load(): Promise<WrappedDataKey[]> {
    await this.pool.query(WRAPPED_KEY_SCHEMA);
    const result = await this.pool.query<{ kms_key_id: string; wrapped_data_key: string }>(
      'SELECT kms_key_id, wrapped_data_key FROM webhook_data_keys',
    );
    return result.rows.map((row) => ({ keyId: row.kms_key_id, ciphertext: row.wrapped_data_key }));
  }

  async save(wrapped: WrappedDataKey): Promise<void> {
    await this.pool.query(
      `INSERT INTO webhook_data_keys (kms_key_id, wrapped_data_key) VALUES ($1, $2)
       ON CONFLICT (kms_key_id) DO NOTHING`,
      [wrapped.keyId, wrapped.ciphertext],
    );
  }
}

/**
 * Envelope encryption on top of any `KeyManagementService`.
 *
 * Stored form: `v1.<kms-key-id>.<iv>.<tag>.<ciphertext>`. Data keys are unwrapped
 * once during `initialize()`, which keeps the `SecretProtector` surface
 * synchronous while the durable material stays KMS-protected at rest.
 */
export class EnvelopeSecretProtector implements SecretProtector {
  readonly #dataKeys = new Map<string, Buffer>();
  #activeKeyId = '';

  constructor(
    private readonly kms: KeyManagementService,
    private readonly store: WrappedKeyStore,
  ) {}

  async initialize(): Promise<void> {
    for (const wrapped of await this.store.load()) {
      try {
        this.#dataKeys.set(wrapped.keyId, await this.kms.unwrap(wrapped));
      } catch {
        // A retired KMS key version cannot be unwrapped; its rows fail closed.
      }
    }
    const active = this.kms.activeKeyId();
    if (!this.#dataKeys.has(active)) {
      const dataKey = randomBytes(32);
      const wrapped = await this.kms.wrap(dataKey);
      await this.store.save(wrapped);
      const reloaded = (await this.store.load()).find((entry) => entry.keyId === active);
      this.#dataKeys.set(active, reloaded ? await this.kms.unwrap(reloaded) : dataKey);
    }
    this.#activeKeyId = active;
  }

  get activeKeyId(): string {
    return this.#activeKeyId;
  }

  encrypt(value: Buffer): string {
    const dataKey = this.#dataKeys.get(this.#activeKeyId);
    if (!dataKey) throw new SecretProtectionError('kms_not_initialized');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
    cipher.setAAD(Buffer.from(this.#activeKeyId, 'utf8'));
    const sealed = Buffer.concat([cipher.update(value), cipher.final()]);
    return [
      'v1',
      this.#activeKeyId,
      iv.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
      sealed.toString('base64url'),
    ].join('.');
  }

  decrypt(value: string): Buffer {
    const parts = value.split('.');
    if (parts[0] !== 'v1' || parts.length !== 5)
      throw new SecretProtectionError('protected_secret_malformed');
    const keyId = parts[1] as string;
    const dataKey = this.#dataKeys.get(keyId);
    if (!dataKey) throw new SecretProtectionError('kms_key_version_unknown');
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        dataKey,
        Buffer.from(parts[2] as string, 'base64url'),
      );
      decipher.setAAD(Buffer.from(keyId, 'utf8'));
      decipher.setAuthTag(Buffer.from(parts[3] as string, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(parts[4] as string, 'base64url')),
        decipher.final(),
      ]);
    } catch {
      throw new SecretProtectionError('kms_decrypt_failed');
    }
  }

  async health(): Promise<boolean> {
    if (!this.#activeKeyId || !this.#dataKeys.has(this.#activeKeyId)) return false;
    if (!(await this.kms.health())) return false;
    const probe = randomBytes(32);
    const round = this.decrypt(this.encrypt(probe));
    return round.length === probe.length && timingSafeEqual(round, probe);
  }
}
