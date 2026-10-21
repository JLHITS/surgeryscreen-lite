import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdminConfigured } from "@/lib/env";
import { Logo } from "@/components/Logo";
import { LoginForm } from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ next?: string }> };

/** Only follow same-site paths after sign-in. */
function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
}

export default async function LoginPage({ searchParams }: Props) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Logo className="text-[22px]" />
          <span className="rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
            Lite
          </span>
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
          {isAdminConfigured() ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the admin password for this SurgeryScreen.
              </p>
              <LoginForm next={next} />
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Sign-in isn&apos;t set up yet. Set <code className="font-mono">ADMIN_PASSWORD</code>{" "}
              (and <code className="font-mono">SESSION_SECRET</code>) on the server, then restart
              it.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
