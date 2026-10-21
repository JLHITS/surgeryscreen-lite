/**
 * Centralised, deploy-time configuration read from environment variables.
 *
 * Storage is fully pluggable so any practice/PCN can self-host with whatever
 * they have available:
 *   - DATABASE_DRIVER=sqlite (default) | postgres
 *   - STORAGE_DRIVER=local (default) | s3
 *
 * This module is import-safe in the edge runtime (no Node APIs) so it can be
 * used from middleware as well as server routes.
 */

function str(name: string, fallback = ""): string {
  return process.env[name]?.trim() || fallback;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(name: string, fallback = false): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  if (v === undefined || v === "") return fallback;
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export type DatabaseDriver = "sqlite" | "postgres";
export type StorageDriver = "local" | "s3";

// Accept the common connection-string variable names that managed Postgres
// providers inject (Vercel Postgres / Neon / Supabase), not just DATABASE_URL.
const databaseUrl =
  str("DATABASE_URL") ||
  str("POSTGRES_URL") ||
  str("POSTGRES_PRISMA_URL") ||
  str("POSTGRES_URL_NON_POOLING");

const databaseDriver: DatabaseDriver = (() => {
  const explicit = str("DATABASE_DRIVER").toLowerCase();
  if (explicit === "postgres" || explicit === "postgresql") return "postgres";
  if (explicit === "sqlite") return "sqlite";
  // No explicit choice: use Postgres automatically when a connection string is
  // present, otherwise fall back to file-based SQLite.
  return databaseUrl ? "postgres" : "sqlite";
})();

/** True on serverless hosts where the local filesystem isn't persistent. */
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY,
);

export const env = {
  /** Password for the admin (username not needed). The admin is locked while it's empty. */
  adminPassword: str("ADMIN_PASSWORD"),
  /** Secret used to sign the session cookie (falls back to one derived from ADMIN_PASSWORD). */
  sessionSecret:
    str("SESSION_SECRET") || `surgeryscreen:${str("ADMIN_PASSWORD", "insecure-dev-secret")}`,
  /** Canonical public address, e.g. https://screen.example.org ("" if unset). */
  siteUrl: str("SITE_URL").replace(/\/$/, ""),

  databaseDriver,
  /** Postgres connection string (postgres driver only). */
  databaseUrl,
  /**
   * PEM certificate of the CA behind the Postgres server's certificate (e.g.
   * DigitalOcean's ${db.CA_CERT}). When set, the server is verified against
   * it; otherwise the connection is encrypted but not verified.
   */
  databaseCaCert: str("DATABASE_CA_CERT").replace(/\\n/g, "\n"),
  /**
   * Connections each server instance may hold to Postgres. Serverless hosts
   * run many small instances against a low connection cap, so they get 2; a
   * long-running server (DigitalOcean, Docker) serves every screen from one
   * pool.
   */
  databasePoolMax: Math.max(1, num("DATABASE_POOL_MAX", isServerless ? 2 : 5)),

  storageDriver: (str("STORAGE_DRIVER", "local") as StorageDriver),
  /** Root directory for the SQLite file and locally stored blobs. */
  dataDir: str("DATA_DIR", "./data"),

  s3: {
    bucket: str("S3_BUCKET"),
    region: str("S3_REGION", "us-east-1"),
    endpoint: str("S3_ENDPOINT"),
    accessKeyId: str("S3_ACCESS_KEY_ID"),
    secretAccessKey: str("S3_SECRET_ACCESS_KEY"),
    /** Public base URL (CDN/public bucket). If set, media redirects here. */
    publicUrl: str("S3_PUBLIC_URL").replace(/\/$/, ""),
    forcePathStyle: bool("S3_FORCE_PATH_STYLE", true),
  },

  /** Maximum accepted upload size, in megabytes. */
  maxUploadMb: num("MAX_UPLOAD_MB", 25),

  isServerless,
} as const;

/** Has an admin password been set? */
export function isAdminConfigured(): boolean {
  return env.adminPassword.length > 0;
}
