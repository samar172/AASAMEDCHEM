import { SignJWT, jwtVerify } from "jose";

/**
 * Edge-compatible JWT helpers (used by both middleware and route handlers).
 * Uses `jose` (Web Crypto) so it runs in the Edge runtime where Node's crypto
 * and bcrypt are unavailable.
 */

export type Role = "admin" | "seller";

export interface SessionPayload {
  sub: string; // user id
  email: string;
  name: string;
  role: Role;
}

const SESSION_COOKIE = "session";
const EXPIRY = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());
}

export async function verifySession(
  token: string | undefined
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
