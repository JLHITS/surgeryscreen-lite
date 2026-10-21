import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { nanoid } from "nanoid";
import { addTextSlide, getPracticeBySlug } from "@/lib/db/repo";
import { createTextSlideSchema } from "@/lib/validation";

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

  const parsed = createTextSlideSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid slide." },
      { status: 400 },
    );
  }

  const slide = await addTextSlide({
    id: nanoid(),
    practiceId: practice.id,
    text: parsed.data.text,
    durationMs: parsed.data.durationMs ?? null,
    startAt: parsed.data.startAt ?? null,
    endAt: parsed.data.endAt ?? null,
    repeat: parsed.data.repeat ?? "none",
  });

  return NextResponse.json({ slide }, { status: 201 });
}
