import "@tanstack/react-start/server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getRequest, setCookie } from "@tanstack/react-start/server";
import { getDb } from "./mongodb.server";
import type { UserDoc } from "./types";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = "marko_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32)
    throw new Error("Set JWT_SECRET (at least 32 characters) in your server environment.");
  return s;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, saltHex, keyHex] = stored.split("$");
  if (alg !== "scrypt" || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, "hex");
  const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function signSession(userId: string) {
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS }),
  );
  const sig = createHmac("sha256", secret()).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verifySession(token: string): string | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now() / 1000
    )
      return null;
    return payload.sub;
  } catch {
    return null;
  }
}

function readCookie(header: string | null, name: string) {
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name)
      return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function setSessionCookie(token: string | null) {
  setCookie(SESSION_COOKIE, token ?? "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: token ? SESSION_SECONDS : 0,
  });
}

/** Returns the signed-in user's id from the request cookie, or null. Also confirms the user still exists. */
export async function currentUserId(): Promise<string | null> {
  const request = getRequest();
  const token = readCookie(request?.headers.get("cookie") ?? null, SESSION_COOKIE);
  const id = token ? verifySession(token) : null;
  if (!id) return null;
  const db = await getDb();
  const user = await db
    .collection<UserDoc>("users")
    .findOne({ id }, { projection: { id: 1, active: 1 } });
  // Disabled accounts lose their session immediately.
  return user && user.active !== false ? id : null;
}
