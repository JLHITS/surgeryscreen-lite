import fs from "node:fs";
import path from "node:path";
import type { ConnectionOptions } from "node:tls";
import { env } from "@/lib/env";

/**
 * Minimal SQL client abstraction. Queries are written once using `?`
 * placeholders (SQLite style); the Postgres client rewrites them to `$n`.
 * This lets a single repository target both engines.
 */
export interface SqlClient {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  /** Execute one or more statements with no parameters (schema setup). */
  exec(sql: string): Promise<void>;
}

/** undefined is not a valid bind value in either driver. */
function sanitize(params: unknown[] = []): unknown[] {
  return params.map((p) => (p === undefined ? null : p));
}

// ---------------------------------------------------------------------------
// SQLite (better-sqlite3) — synchronous, wrapped in resolved promises.
// ---------------------------------------------------------------------------

function createSqliteClient(): SqlClient {
  // Lazy require so the native module is only loaded when actually used.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require("better-sqlite3") as typeof import("better-sqlite3");

  const dir = path.resolve(env.dataDir);
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, "surgeryscreen.db"));
  db.pragma("journal_mode = WAL");

  // SQLite has no boolean type; coerce booleans to integers.
  const prep = (params: unknown[] = []) =>
    sanitize(params).map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));

  return {
    async all<T>(sql: string, params?: unknown[]) {
      return db.prepare(sql).all(...prep(params)) as T[];
    },
    async get<T>(sql: string, params?: unknown[]) {
      return db.prepare(sql).get(...prep(params)) as T | undefined;
    },
    async run(sql: string, params?: unknown[]) {
      db.prepare(sql).run(...prep(params));
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  };
}

// ---------------------------------------------------------------------------
// Postgres (pg) — converts `?` placeholders to `$n`.
// ---------------------------------------------------------------------------

function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** The connection string minus its TLS parameters, so the `ssl` option applies. */
function withoutSslParams(url: string): string {
  const q = url.indexOf("?");
  if (q === -1) return url;
  const kept = url
    .slice(q + 1)
    .split("&")
    .filter((p) => p && !/^(ssl|sslmode|sslrootcert|sslcert|sslkey|uselibpqcompat)=/i.test(p));
  return kept.length > 0 ? `${url.slice(0, q)}?${kept.join("&")}` : url.slice(0, q);
}

/**
 * Connection string and TLS settings. Managed Postgres (DigitalOcean,
 * Supabase, Neon, RDS…) requires TLS but serves certificates from its own CA,
 * which Node doesn't trust out of the box. With DATABASE_CA_CERT the server is
 * verified against that CA; without it the connection is encrypted but not
 * verified. A `sslmode` in the URL would otherwise win over the `ssl` option
 * (surfacing as "self-signed certificate in certificate chain"), so it's
 * removed.
 */
function postgresConnection(url: string): { connectionString: string; ssl?: ConnectionOptions } {
  if (env.databaseCaCert) {
    return {
      connectionString: withoutSslParams(url),
      ssl: { ca: env.databaseCaCert, rejectUnauthorized: true },
    };
  }
  const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])|sslmode=disable/.test(url);
  if (isLocal) return { connectionString: url };
  return { connectionString: withoutSslParams(url), ssl: { rejectUnauthorized: false } };
}

function createPostgresClient(): SqlClient {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pool } = require("pg") as typeof import("pg");
  if (!env.databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when DATABASE_DRIVER=postgres.",
    );
  }
  const pool = new Pool({
    ...postgresConnection(env.databaseUrl),
    // Queries here are single-digit-ms lookups, so a few connections serve
    // every screen; see env.databasePoolMax.
    max: env.databasePoolMax,
    // Release idle connections quickly so quiet instances don't sit on them.
    idleTimeoutMillis: 30_000,
    // Fail fast instead of hanging a request if the pool is exhausted.
    connectionTimeoutMillis: 10_000,
  });
  // The database closing an idle connection (a restart, failover or
  // maintenance) is reported here. Unhandled, it would crash the whole server;
  // the pool opens a fresh connection for the next query.
  pool.on("error", (err) => {
    console.error("Postgres connection dropped:", err.message);
  });

  return {
    async all<T>(sql: string, params?: unknown[]) {
      const res = await pool.query(toPgPlaceholders(sql), sanitize(params));
      return res.rows as T[];
    },
    async get<T>(sql: string, params?: unknown[]) {
      const res = await pool.query(toPgPlaceholders(sql), sanitize(params));
      return res.rows[0] as T | undefined;
    },
    async run(sql: string, params?: unknown[]) {
      await pool.query(toPgPlaceholders(sql), sanitize(params));
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
  };
}

let client: SqlClient | null = null;

/** Get the process-wide SQL client for the configured database driver. */
export function getSqlClient(): SqlClient {
  if (client) return client;
  client =
    env.databaseDriver === "postgres"
      ? createPostgresClient()
      : createSqliteClient();
  return client;
}
