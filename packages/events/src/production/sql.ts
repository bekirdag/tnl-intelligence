/**
 * Minimal SQL ports used by the production webhook adapters.
 *
 * The `@theneuralledger/events` package stays dependency free, so concrete
 * drivers (`pg`, `mysql2`) are resolved lazily at runtime by the deployment.
 */

export interface SqlRows<T> {
  rows: T[];
}

export interface SqlClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlRows<T>>;
}

export interface SqlPool extends SqlClient {
  transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface PostgresPoolOptions {
  connectionString: string;
  maxConnections?: number;
  statementTimeoutMs?: number;
  applicationName?: string;
}

interface DriverClient {
  query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }>;
  release(): void;
}

interface DriverPool {
  connect(): Promise<DriverClient>;
  query(text: string, values?: readonly unknown[]): Promise<{ rows: unknown[] }>;
  end(): Promise<void>;
  on(event: string, listener: (error: Error) => void): unknown;
}

/**
 * Builds a `pg`-backed pool. The driver is imported through a computed
 * specifier so TypeScript never requires the optional dependency at build time.
 */
export async function createPostgresPool(options: PostgresPoolOptions): Promise<SqlPool> {
  const driver = (await import(/* webpackIgnore: true */ 'pg' as string)) as {
    default?: { Pool: new (config: Record<string, unknown>) => DriverPool };
    Pool?: new (config: Record<string, unknown>) => DriverPool;
  };
  const Pool = driver.Pool ?? driver.default?.Pool;
  if (!Pool) throw new Error('the pg driver does not expose a Pool constructor');
  const pool = new Pool({
    connectionString: options.connectionString,
    max: options.maxConnections ?? 8,
    application_name: options.applicationName ?? 'tnl-webhooks',
    statement_timeout: options.statementTimeoutMs ?? 15_000,
    idle_in_transaction_session_timeout: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  // An unhandled pool error must never take the service down.
  pool.on('error', () => {});
  return {
    async query<T>(text: string, values?: readonly unknown[]): Promise<SqlRows<T>> {
      const result = await pool.query(text, values);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(work: (client: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const value = await work({
          async query<R>(text: string, values?: readonly unknown[]): Promise<SqlRows<R>> {
            const result = await client.query(text, values);
            return { rows: result.rows as R[] };
          },
        });
        await client.query('COMMIT');
        return value;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // The rollback failure is reported through the original error.
        }
        throw error;
      } finally {
        client.release();
      }
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
}
