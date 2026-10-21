import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { getPracticeBySlug, unpublish } from "@/lib/db/repo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  const practice = await getPracticeBySlug(slug);
  if (!practice) {
    return NextResponse.json({ error: "Practice not found." }, { status: 404 });
  }
  await unpublish(practice.id);
  return NextResponse.json({ ok: true });
}
