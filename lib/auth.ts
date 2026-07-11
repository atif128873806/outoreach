import { cookies } from "next/headers";
import { q, q1, type User } from "./db";
import {
  hashPassword,
  verifyPassword,
  verifySessionToken,
  createEmailToken,
  hashEmailToken,
  SESSION_COOKIE,
} from "./crypto";
import { isSystemMailerConfigured } from "./system-mailer";

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

// ---------- email verification ----------

const VERIFY_TOKEN_HOURS = 48;

/**
 * Verification is only enforced when the instance can actually send the
 * verification email. Self-hosted setups without a system mailer skip it.
 */
export function isVerificationEnforced(): boolean {
  return isSystemMailerConfigured();
}

/** True when the user may use gated features (real sending, global AI). */
export async function isEmailVerified(userId: number): Promise<boolean> {
  if (!isVerificationEnforced()) return true;
  const row = await q1<{ email_verified: number }>(
    "SELECT email_verified FROM users WHERE id = $1",
    [userId]
  );
  return Boolean(row?.email_verified);
}

/** Issues a fresh verification token and returns the raw value to email. */
export async function startEmailVerification(userId: number): Promise<string> {
  const { raw, hash } = createEmailToken();
  const expires = new Date(Date.now() + VERIFY_TOKEN_HOURS * 3600_000).toISOString();
  await q("UPDATE users SET verify_token = $1, verify_expires = $2 WHERE id = $3", [
    hash,
    expires,
    userId,
  ]);
  return raw;
}

/** Consumes a verification token. Returns the verified user's id, or null. */
export async function verifyEmailToken(raw: string): Promise<number | null> {
  if (!raw || raw.length > 200) return null;
  const rows = await q<{ id: number }>(
    `UPDATE users SET email_verified = 1, verify_token = NULL, verify_expires = NULL
     WHERE verify_token = $1 AND verify_expires > now()
     RETURNING id`,
    [hashEmailToken(raw)]
  );
  return rows[0]?.id ?? null;
}

// ---------- password reset ----------

const RESET_TOKEN_MINUTES = 60;

/**
 * Issues a reset token for the account with this email. Returns the raw token
 * to email, or null when no account matches (caller responds identically
 * either way, so addresses can't be enumerated).
 */
export async function startPasswordReset(
  email: string
): Promise<{ userId: number; token: string; name: string } | null> {
  const user = await q1<User>("SELECT * FROM users WHERE email = $1", [
    email.trim().toLowerCase(),
  ]);
  if (!user) return null;
  const { raw, hash } = createEmailToken();
  const expires = new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000).toISOString();
  await q("UPDATE users SET reset_token = $1, reset_expires = $2 WHERE id = $3", [
    hash,
    expires,
    user.id,
  ]);
  return { userId: user.id, token: raw, name: user.name };
}

/**
 * Consumes a reset token and sets the new password. Also marks the email
 * verified — completing a reset proves mailbox ownership. Returns the user id
 * on success or an error message.
 */
export async function resetPasswordWithToken(
  raw: string,
  newPassword: string
): Promise<{ userId: number } | { error: string }> {
  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" };
  if (!raw || raw.length > 200) return { error: "This reset link is invalid" };
  const rows = await q<{ id: number }>(
    `UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires = NULL,
       email_verified = 1, verify_token = NULL, verify_expires = NULL
     WHERE reset_token = $2 AND reset_expires > now()
     RETURNING id`,
    [hashPassword(newPassword), hashEmailToken(raw)]
  );
  if (!rows[0]) return { error: "This reset link is invalid or has expired — request a new one" };
  return { userId: rows[0].id };
}

export async function getUser(
  userId: number
): Promise<{ id: number; email: string; name: string; is_admin: number; email_verified: number; plan: string } | null> {
  const user = await q1<User>(
    "SELECT id, email, name, is_admin, email_verified, plan FROM users WHERE id = $1",
    [userId]
  );
  return user ?? null;
}
