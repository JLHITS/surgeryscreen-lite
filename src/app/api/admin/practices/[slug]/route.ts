import { NextResponse } from "next/server";
import {
  deletePractice,
  getPracticeBySlug,
  getPracticeWithSlides,
  updatePractice,
} from "@/lib/db/repo";
import { getBlobStore } from "@/lib/blob";
import {
  practiceLogosPrefix,
  practiceOriginalsPrefix,
  practicePublishedPrefix,
} from "@/lib/keys";
import { requireAdmin } from "@/lib/session";
import { updatePracticeSchema } from "@/lib/validation";
import { normaliseSettings, type SlideshowSettings } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

/** JSON with sorted keys, so structurally equal objects stringify equally. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const rec = v as Record<string, unknown>;
  const body = Object.keys(rec)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(rec[k])}`)
    .join(",");
  return `{${body}}`;
}

/** Saving settings that didn't change shouldn't flag unpublished changes. */
function settingsChanged(before: SlideshowSettings, after: SlideshowSettings): boolean {
  return stable(before) !== stable(after);
}

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeWithSlides(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }
  return NextResponse.json({ practice });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { slug } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const parsed = updatePracticeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 },
    );
  }
  const settings = parsed.data.settings
    ? normaliseSettings(parsed.data.settings)
    : undefined;
  const markDirty =
    parsed.data.name !== undefined ||
    (settings !== undefined && settingsChanged(practice.settings, settings));

  await updatePractice(
    practice.id,
    { name: parsed.data.name, settings },
    { markDirty },
  );
  return NextResponse.json({ practice: await getPracticeWithSlides(slug) });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const { slug } = await params;
  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }

  const blob = getBlobStore();
  await blob.deletePrefix(practiceOriginalsPrefix(practice.id)).catch(() => {});
  await blob.deletePrefix(practicePublishedPrefix(practice.id)).catch(() => {});
  await blob.deletePrefix(practiceLogosPrefix(practice.id)).catch(() => {});
  await deletePractice(practice.id);

  return NextResponse.json({ ok: true });
}
