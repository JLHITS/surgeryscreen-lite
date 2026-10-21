import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getPracticeBySlug } from "@/lib/db/repo";
import { extForContentType } from "@/lib/blob";
import { ingestImageAsSlide } from "@/lib/ingest";
import { env } from "@/lib/env";
import { ACCEPTED_IMAGE_TYPES } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    return NextResponse.json({ error: "No image file provided." }, { status: 400 });
  }

  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a JPEG, PNG, WebP, GIF or AVIF image." },
      { status: 415 },
    );
  }

  const maxBytes = env.maxUploadMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Image is too large (max ${env.maxUploadMb} MB).` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extForContentType(file.type) || path.extname(file.name).toLowerCase() || ".img";

  try {
    const slide = await ingestImageAsSlide({
      practiceId: practice.id,
      buffer,
      contentType: file.type,
      ext,
    });
    return NextResponse.json({ slide }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "That image could not be read. It may be corrupt." },
      { status: 400 },
    );
  }
}
