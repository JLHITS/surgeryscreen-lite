import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getPublishedSnapshot } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** Does an If-None-Match header list this ETag? (Weak comparison: proxies that compress may add W/.) */
function matchesEtag(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((tag) => tag.trim().replace(/^W\//, "") === etag);
}

/**
 * Public snapshot consumed by display devices. Devices poll this endpoint and
 * swap content in place whenever `version` increases, so it must never be
 * cached. Each poll sends the ETag of what it already shows; while nothing has
 * changed the answer is an empty 304, which keeps a screen's data use (and the
 * host's bandwidth) small on a 20-second poll.
 */
export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const snapshot = await getPublishedSnapshot(slug);

  if (!snapshot) {
    return NextResponse.json(
      { error: "not_published" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = JSON.stringify(snapshot);
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { "Cache-Control": "no-store", ETag: etag };

  if (matchesEtag(req.headers.get("if-none-match"), etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, {
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
