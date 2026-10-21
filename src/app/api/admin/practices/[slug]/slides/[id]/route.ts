import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  deleteSlide,
  getPracticeBySlug,
  getSlide,
  updateSlide,
} from "@/lib/db/repo";
import { getBlobStore } from "@/lib/blob";
import { practiceOriginalsPrefix } from "@/lib/keys";
import { slideUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const parsed = slideUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }

  await updateSlide(id, practice.id, parsed.data);
  return NextResponse.json({ slide: await getSlide(id) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { slug, id } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const slide = await getSlide(id);
  // Guard: only touch a slide that genuinely belongs to this practice.
  if (slide && slide.originalKey.startsWith(practiceOriginalsPrefix(practice.id))) {
    await getBlobStore().delete(slide.originalKey).catch(() => {});
  }
  await deleteSlide(id, practice.id);

  return NextResponse.json({ ok: true });
}
