import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { nanoid } from "nanoid";
import { addVideoSlide, getPracticeBySlug } from "@/lib/db/repo";
import { createVideoSlideSchema } from "@/lib/validation";

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

  const parsed = createVideoSlideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid slide." },
      { status: 400 },
    );
  }

  const slide = await addVideoSlide({
    id: nanoid(),
    practiceId: practice.id,
    video: parsed.data.video,
    durationMs: parsed.data.durationMs ?? null,
    startAt: parsed.data.startAt ?? null,
    endAt: parsed.data.endAt ?? null,
    repeat: parsed.data.repeat ?? "none",
  });

  return NextResponse.json({ slide }, { status: 201 });
}
