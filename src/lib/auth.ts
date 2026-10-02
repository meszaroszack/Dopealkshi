import crypto from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";

const COOKIE = "dopealkshi_session";

export type SessionUser = {
  id: string;
  email: string;
  role: string;
  tier: string;
  disabled: boolean;
  free_markets_used: number;
  skip_windows: number;
  bonus_market_granted: boolean;
};

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = crypto.scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  if (next.length !== prev.length) return false;
  return crypto.timingSafeEqual(next, prev);
}

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await query(
    "insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)",
    [userId, hashToken(token), expires.toISOString()],
  );
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function clearSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await query("delete from sessions where token_hash = $1", [hashToken(token)]);
  }
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const rows = await query<SessionUser>(
    `select u.id, u.email, p.role, p.tier, p.disabled, p.free_markets_used, p.skip_windows, p.bonus_market_granted
     from sessions s
     join users u on u.id = s.user_id
     join profiles p on p.id = u.id
     where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] ?? null;
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function roleFor(email: string, existingUsers: number) {
  const list = adminEmails();
  if (list.length === 0 && existingUsers === 0) return "admin";
  if (list.includes(email.toLowerCase())) return "admin";
  return "user";
}
