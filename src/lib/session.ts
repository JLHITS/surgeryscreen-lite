import { cache } from "react";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken, type Session } from "@/lib/auth";

/** The signed-in admin, if any (checked once per request). */
export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
});

/** Route guard: the session if signed in, else a response to return. */
export async function requireAdmin(): Promise<Session | NextResponse> {
  const session = await getSession();
  return (
    session ??
    NextResponse.json({ error: "Your session has ended. Please sign in again." }, { status: 401 })
  );
}
