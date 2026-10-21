import { Database, ExternalLink, HardDrive, TriangleAlert } from "lucide-react";

/**
 * Shown when the admin area can't reach its database/storage — almost always a
 * misconfiguration on first deploy (e.g. SQLite + local disk on a serverless
 * host with no persistent filesystem). Turns an opaque 500 into next steps.
 */
export function AdminSetupError({
  databaseDriver,
  storageDriver,
  serverless,
  message,
}: {
  databaseDriver: string;
  storageDriver: string;
  serverless: boolean;
  message: string;
}) {
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-2xl flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">Storage isn’t ready yet</h1>
            <p className="text-sm text-muted-foreground">
              SurgeryScreen couldn’t open its database or file storage.
            </p>
          </div>
        </div>

        {serverless && (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            You’re running on a <strong>serverless host</strong> (e.g. Vercel),
            which has no persistent filesystem. The default{" "}
            <code className="font-mono">sqlite</code> +{" "}
            <code className="font-mono">local</code> storage can’t be used here —
            connect a managed Postgres database and an S3-compatible bucket
            instead.
          </div>
        )}

        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              <strong>Database</strong> — add a Postgres database and set{" "}
              <code className="font-mono">DATABASE_URL</code> (Vercel Postgres &
              Neon inject this automatically). Currently:{" "}
              <code className="font-mono">{databaseDriver}</code>.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <HardDrive className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p>
              <strong>Image storage</strong> — set{" "}
              <code className="font-mono">STORAGE_DRIVER=s3</code> with your bucket
              credentials (AWS S3, Cloudflare R2, MinIO…). Currently:{" "}
              <code className="font-mono">{storageDriver}</code>.
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm text-muted-foreground">
          Prefer the zero-config setup? Deploy with Docker or any host that has a
          persistent disk — then SQLite + local storage works with only{" "}
          <code className="font-mono">ADMIN_PASSWORD</code> and{" "}
          <code className="font-mono">SESSION_SECRET</code> set.
        </p>

        <a
          href="https://github.com/JLHITS/surgeryscreen-lite#configuration"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Configuration guide
          <ExternalLink className="size-3.5" />
        </a>

        <details className="mt-6">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Technical details
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {message}
          </pre>
        </details>
      </div>
    </main>
  );
}
