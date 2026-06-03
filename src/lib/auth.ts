import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import {
  signSession,
  verifySession,
  SESSION_COOKIE_NAME,
  type SessionPayload,
  type Role,
} from "./jwt";

/**
 * Node-runtime auth helpers. bcrypt is not edge-compatible, so anything in this
 * file must only be imported from Route Handlers / Server Components / Server
 * Actions (the Node runtime) — never from middleware.
 */

const SALT_ROUNDS = 10;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Create the session cookie after a successful login. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Read & verify the current session from the request cookies. */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

/** Throw-style guard for use in Server Components / Route Handlers. */
export async function requireRole(role: Role): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHENTICATED");
  if (session.role !== role) throw new Error("FORBIDDEN");
  return session;
}

export type { SessionPayload, Role };
