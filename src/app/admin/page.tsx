import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { getSession } from "@/lib/session";
import { listPractices } from "@/lib/db/repo";
import { DashboardClient } from "@/components/admin/DashboardClient";
import { AdminSetupError } from "@/components/admin/AdminSetupError";
import type { Practice } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your display" };

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let practices: Practice[];
  try {
    practices = await listPractices();
  } catch (err) {
    return (
      <AdminSetupError
        databaseDriver={env.databaseDriver}
        storageDriver={env.storageDriver}
        serverless={env.isServerless}
        message={err instanceof Error ? err.message : String(err)}
      />
    );
  }

  const warnings: string[] = [];
  if (env.isServerless && env.storageDriver === "local") {
    warnings.push(
      "This looks like a serverless host with local image storage — uploads won't persist. Set STORAGE_DRIVER=s3 (e.g. Cloudflare R2 or AWS S3).",
    );
  }
  if (!process.env.SESSION_SECRET) {
    warnings.push(
      "SESSION_SECRET isn't set, so sign-ins are signed with a key made from ADMIN_PASSWORD. Set SESSION_SECRET to a long random string.",
    );
  }

  return <DashboardClient initialPractices={practices} warnings={warnings} />;
}
