import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { nanoid } from "nanoid";
import { getPracticeBySlug } from "@/lib/db/repo";
import { getBlobStore, extForContentType } from "@/lib/blob";
import { practiceLogoKey } from "@/lib/keys";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
  "image/avif",
];

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No logo file provided." }, { status: 400 });
  }
  if (!LOGO_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Use a PNG, JPEG, WebP or SVG logo." },
      { status: 415 },
    );
  }
  if (file.size > env.maxUploadMb * 1024 * 1024) {
    return NextResponse.json(
      { error: `Logo is too large (max ${env.maxUploadMb} MB).` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extForContentType(file.type) || path.extname(file.name).toLowerCase() || ".png";
  const key = practiceLogoKey(practice.id, nanoid(), ext);
  await getBlobStore().put(key, buffer, file.type);

  return NextResponse.json({ key });
}
