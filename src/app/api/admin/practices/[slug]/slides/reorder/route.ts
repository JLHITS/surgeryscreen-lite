import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getPracticeBySlug, reorderSlides } from "@/lib/db/repo";
import { reorderSchema } from "@/lib/validation";

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

  const parsed = reorderSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ordering." }, { status: 400 });
  }

  await reorderSlides(practice.id, parsed.data.orderedIds);
  return NextResponse.json({ ok: true });
}
