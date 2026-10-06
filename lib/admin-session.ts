import { randomBytes, createHash } from "node:crypto";
import { verifyPassword } from "./crypto";

export const ADMIN_COOKIE = "os_admin_session";
export const ADMIN_SESSION_SECONDS = 8 * 3600;
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");

/** Opaque, revocable admin sessions cannot be used as product HMAC sessions. */
export async function issueAdminSession(userId: number, password: string): Promise<string | null> {
  const { getDb } = await import("./db");
  return (await getDb()).transaction(async tx => {
    const [user] = await tx.query<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id = $1 AND is_admin = 1 FOR UPDATE", [userId]);
    if (!user || !verifyPassword(password,user.password_hash)) return null;
    const raw = randomBytes(32).toString("hex");
    await tx.query("DELETE FROM admin_sessions WHERE expires_at <= now()");
    await tx.query(`INSERT INTO admin_sessions(token_hash,user_id,password_stamp,expires_at)
      VALUES ($1,$2,$3,now() + interval '${ADMIN_SESSION_SECONDS} seconds')`,
      [tokenHash(raw),userId,tokenHash(user.password_hash)]);
    await tx.query("INSERT INTO admin_audit_events(actor_id,action) VALUES ($1,'admin-login')", [userId]);
    return raw;
  });
}

export async function adminSessionUser(raw: string | undefined): Promise<number | null> {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const { q1 } = await import("./db");
  const row = await q1<{ user_id: number; password_stamp: string; password_hash: string }>(
    `SELECT s.user_id,s.password_stamp,u.password_hash FROM admin_sessions s
      JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now() AND u.is_admin=1`, [tokenHash(raw)]);
  return row && row.password_stamp === tokenHash(row.password_hash) ? row.user_id : null;
}

export async function revokeAdminSession(raw: string | undefined): Promise<void> {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return;
  const { getDb } = await import("./db");
  await (await getDb()).transaction(async tx => {
    const rows = await tx.query<{ user_id: number }>("DELETE FROM admin_sessions WHERE token_hash=$1 RETURNING user_id", [tokenHash(raw)]);
    if (rows[0]) await tx.query("INSERT INTO admin_audit_events(actor_id,action) VALUES ($1,'admin-logout')", [rows[0].user_id]);
  });
}

export { safeAdminNext, validAdminOrigin } from "./admin-policy";
