import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createPractice, getPracticeBySlug, listPractices } from "@/lib/db/repo";
import { requireAdmin } from "@/lib/session";
import { createPracticeSchema } from "@/lib/validation";
import { isValidSlug, suggestSlug } from "@/lib/slug";
import { DEFAULT_SETTINGS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  return NextResponse.json({ practices: await listPractices() });
}

/** Create the display. Lite runs one; SurgeryScreen runs as many as you need. */
export async function POST(req: Request) {
  const access = await requireAdmin();
  if (access instanceof NextResponse) return access;

  if ((await listPractices()).length > 0) {
    return NextResponse.json(
      { error: "SurgeryScreen Lite runs one display. Delete the existing one to start again." },
      { status: 409 },
    );
  }

  const parsed = createPracticeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "A display name is required." }, { status: 400 });
  }

  const { name } = parsed.data;
  const slug = parsed.data.slug?.trim() || suggestSlug(name);

  if (!isValidSlug(slug)) {
    return NextResponse.json(
      {
        error:
          "Invalid URL. Use letters, numbers, hyphens or underscores (and not a reserved word).",
      },
      { status: 400 },
    );
  }

  if (await getPracticeBySlug(slug)) {
    return NextResponse.json(
      { error: `The URL "/${slug}" is already in use.` },
      { status: 409 },
    );
  }

  const practice = await createPractice({
    id: nanoid(),
    slug,
    name,
    settings: DEFAULT_SETTINGS,
  });

  return NextResponse.json({ practice }, { status: 201 });
}
