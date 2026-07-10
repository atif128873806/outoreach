import crypto from "crypto";
import fs from "fs";
import path from "path";

/**
 * App secret + credential encryption.
 *
 * The app secret signs session cookies and encrypts stored credentials.
 * It comes from the APP_SECRET env var when set; otherwise a random secret is
 * generated once and kept in data/.secret (mode 0600). Losing the secret only
 * means re-entering stored passwords/API keys — nothing else breaks.
 */

const globalForSecret = globalThis as unknown as { __outreachSecret?: string };

export function getAppSecret(): string {
  if (globalForSecret.__outreachSecret) return globalForSecret.__outreachSecret;

  let secret = process.env.APP_SECRET?.trim() || "";
  if (!secret) {
    const file = path.join(process.cwd(), "data", ".secret");
    try {
      secret = fs.readFileSync(file, "utf8").trim();
    } catch {
      secret = crypto.randomBytes(32).toString("hex");
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, secret, { mode: 0o600 });
    }
  }
  globalForSecret.__outreachSecret = secret;
  return secret;
}

function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(getAppSecret()).digest();
}

const ENC_PREFIX = "enc:v1:";

/** AES-256-GCM. Output format: enc:v1:<iv>:<authTag>:<ciphertext> (base64). */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

/** Decrypts enc:v1 values; passes legacy plaintext through untouched. */
export function decryptSecret(stored: string): string {
  if (!stored || !isEncrypted(stored)) return stored;
  try {
    const [iv, tag, data] = stored.slice(ENC_PREFIX.length).split(":");
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    console.error(
      "[crypto] failed to decrypt a stored credential — was APP_SECRET or data/.secret changed? Re-enter it in Settings."
    );
    return "";
  }
}

// ---------- password hashing (scrypt) ----------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `s1$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "s1" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- session cookies ----------

export const SESSION_COOKIE = "os_session";
const SESSION_DAYS = 30;

function sign(payload: string): string {
  return crypto.createHmac("sha256", getAppSecret()).update(payload).digest("hex");
}

/** Cookie value: <expiryMs>.<hmac(expiryMs)> */
export function createSessionToken(): { value: string; maxAge: number } {
  const expiry = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return {
    value: `${expiry}.${sign(expiry)}`,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  };
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const expiry = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d+$/.test(expiry) || Number(expiry) < Date.now()) return false;
  const expected = sign(expiry);
  return (
    mac.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  );
}

// ---------- auth-enabled flag (read by proxy.ts without touching the DB) ----------

export const AUTH_FLAG_FILE = path.join(process.cwd(), "data", ".auth-required");

export function setAuthFlag(enabled: boolean): void {
  try {
    if (enabled) {
      fs.mkdirSync(path.dirname(AUTH_FLAG_FILE), { recursive: true });
      fs.writeFileSync(AUTH_FLAG_FILE, "1");
    } else {
      fs.rmSync(AUTH_FLAG_FILE, { force: true });
    }
  } catch (err) {
    console.error("[crypto] could not update auth flag file:", err);
  }
}
