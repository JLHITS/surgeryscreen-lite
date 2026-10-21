import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { nanoid } from "nanoid";
import { getPracticeBySlug, getSlideOwned, insertSlideAfter } from "@/lib/db/repo";
import { getBlobStore } from "@/lib/blob";
import { originalKey } from "@/lib/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const source = await getSlideOwned(id, practice.id);
  if (!source) {
    return NextResponse.json({ error: "Slide not found." }, { status: 404 });
  }

  const newId = nanoid();
  let newOriginalKey = "";

  if (source.kind === "image") {
    const blob = getBlobStore();
    const obj = await blob.getObject(source.originalKey);
    if (!obj) {
      return NextResponse.json(
        { error: "Could not read the original image." },
        { status: 400 },
      );
    }
    const ext = path.extname(source.originalKey) || ".img";
    newOriginalKey = originalKey(practice.id, newId, ext);
    await blob.put(newOriginalKey, obj.body, obj.contentType);
  }

  const slide = await insertSlideAfter({
    source,
    practiceId: practice.id,
    newId,
    newOriginalKey,
  });

  return NextResponse.json({ slide }, { status: 201 });
}
