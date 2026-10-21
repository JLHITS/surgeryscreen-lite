import { NextResponse } from "next/server";
import { getBlobStore } from "@/lib/blob";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ key: string[] }> };

/**
 * Serve a stored blob behind a stable URL. If the backend can serve the object
 * directly (e.g. an S3 public/CDN base URL) we redirect there; otherwise we
 * stream it. All blobs are content-addressed by an immutable key, so they are
 * safe to cache aggressively.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { key: parts } = await params;
  const key = parts.map((p) => decodeURIComponent(p)).join("/");

  // Defensive: never allow path traversal out of the blob namespace.
  if (key.includes("..")) {
    return new NextResponse("Bad request", { status: 400 });
  }

  const store = getBlobStore();

  const direct = store.directUrl(key);
  if (direct) {
    return NextResponse.redirect(direct, 302);
  }

  const object = await store.getObject(key);
  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.body.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
