import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { PublishError, publishPractice } from "@/lib/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image normalisation can take a few seconds for many slides.
export const maxDuration = 60;

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  try {
    const snapshot = await publishPractice(slug);
    return NextResponse.json({ ok: true, snapshot });
  } catch (err) {
    if (err instanceof PublishError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Publish failed:", err);
    return NextResponse.json(
      { error: "Publishing failed. Please try again." },
      { status: 500 },
    );
  }
}
