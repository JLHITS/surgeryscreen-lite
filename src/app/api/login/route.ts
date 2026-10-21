import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS, checkAdminPassword, createSessionToken } from "@/lib/auth";
import { isAdminConfigured } from "@/lib/env";
import { allow, clientIp } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** Sign in with ADMIN_PASSWORD. */
export async function POST(req: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "Sign-in isn't set up yet. Set ADMIN_PASSWORD on the server." },
      { status: 503 },
    );
  }
  if (!allow(`login:${clientIp(req)}`, 10, 15 * 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again in 15 minutes." },
      { status: 429 },
    );
  }
  const parsed = loginSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !checkAdminPassword(parsed.data.password)) {
    return NextResponse.json({ error: "That password isn't right." }, { status: 401 });
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(), SESSION_COOKIE_OPTIONS);
  return NextResponse.json({ ok: true });
}
