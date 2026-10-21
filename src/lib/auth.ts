import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

/**
 * The admin session. SurgeryScreen Lite has one admin, who signs in with
 * ADMIN_PASSWORD; a successful sign-in mints a signed (HS256) session cookie.
 * This module avoids Node-only APIs so the proxy can use it too.
 */

export const SESSION_COOKIE = "ss_session";
const SESSION_TTL = "30d";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export interface Session {
  role: "admin";
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

/** Constant-time string comparison (no Node crypto dependency). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Check a submitted password against ADMIN_PASSWORD. */
export function checkAdminPassword(input: string): boolean {
  if (!env.adminPassword) return false;
  return safeEqual(input, env.adminPassword);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(secretKey());
}

/** Decode a session cookie: the admin session if it's genuine, else null. */
export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return payload.role === "admin" ? { role: "admin" } : null;
  } catch {
    return null;
  }
}
