import { cookies } from "next/headers";
import { q, q1, type User } from "./db";
import { hashPassword, verifyPassword, verifySessionToken, SESSION_COOKIE } from "./crypto";

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The signed-in user's id, or null. Route handlers call this first. */
export async function getUserId(): Promise<number | null> {
  const store = await cookies();
  const uid = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (uid == null) return null;
  const row = await q1<{ id: number }>("SELECT id FROM users WHERE id = $1", [uid]);
  return row ? uid : null;
}

/** Like getUserId but throws — use inside try/catch or let Next return 500… prefer explicit checks. */
export async function requireUserId(): Promise<number> {
  const uid = await getUserId();
  if (uid == null) throw new UnauthorizedError();
  return uid;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function userCount(): Promise<number> {
  const row = await q1<{ n: string | number }>("SELECT COUNT(*) n FROM users");
  return Number(row?.n ?? 0);
}

export async function createUser(
  email: string,
  name: string,
  password: string
): Promise<{ id: number; isAdmin: boolean } | { error: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!VALID_EMAIL.test(cleanEmail)) return { error: "Enter a valid email address" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const existing = await q1("SELECT 1 FROM users WHERE email = $1", [cleanEmail]);
  if (existing) return { error: "An account with this email already exists" };

  // The very first account on an instance is the owner/admin.
  const isFirst = (await userCount()) === 0;
  const rows = await q<{ id: number }>(
    "INSERT INTO users (email, name, password_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING id",
    [cleanEmail, name.trim(), hashPassword(password), isFirst ? 1 : 0]
  );
  return { id: rows[0].id, isAdmin: isFirst };
}

export async function isAdmin(userId: number): Promise<boolean> {
  const row = await q1<{ is_admin: number }>("SELECT is_admin FROM users WHERE id = $1", [userId]);
  return Boolean(row?.is_admin);
}

export async function verifyLogin(email: string, password: string): Promise<number | null> {
  const user = await q1<User>("SELECT * FROM users WHERE email = $1", [
    email.trim().toLowerCase(),
  ]);
  if (!user || !verifyPassword(password, user.password_hash)) return null;
  return user.id;
}

export async function changePassword(
  userId: number,
  current: string,
  next: string
): Promise<string | null> {
  if (next.length < 8) return "New password must be at least 8 characters";
  const user = await q1<User>("SELECT * FROM users WHERE id = $1", [userId]);
  if (!user || !verifyPassword(current, user.password_hash)) {
    return "Current password is wrong";
  }
  await q("UPDATE users SET password_hash = $1 WHERE id = $2", [hashPassword(next), userId]);
  return null;
}

export async function getUser(
  userId: number
): Promise<{ id: number; email: string; name: string; is_admin: number } | null> {
  const user = await q1<User>(
    "SELECT id, email, name, is_admin FROM users WHERE id = $1",
    [userId]
  );
  return user ?? null;
}
