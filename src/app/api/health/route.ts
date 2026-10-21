import { NextResponse } from "next/server";
import { pingDatabase } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check for your host or Docker: 200 once this server can reach its
 * database, 503 while it can't.
 */
export async function GET() {
  try {
    await pingDatabase();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("Health check failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
