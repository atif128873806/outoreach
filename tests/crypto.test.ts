import { test } from "node:test";
import assert from "node:assert/strict";

// Fixed secret so tests never touch data/.secret
process.env.APP_SECRET = "test-secret-for-unit-tests";

const {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  createEmailToken,
  hashEmailToken,
} = await import("../lib/crypto.ts");

test("encryptSecret / decryptSecret round-trips", () => {
  const secret = "smtp-password-123!@#";
  const stored = encryptSecret(secret);
  assert.ok(isEncrypted(stored));
  assert.notEqual(stored, secret);
  assert.equal(decryptSecret(stored), secret);
});

test("encryptSecret produces a fresh ciphertext every call (random IV)", () => {
  assert.notEqual(encryptSecret("same"), encryptSecret("same"));
});

test("decryptSecret passes legacy plaintext through and empty stays empty", () => {
  assert.equal(decryptSecret("plain-old-password"), "plain-old-password");
  assert.equal(decryptSecret(""), "");
  assert.equal(encryptSecret(""), "");
});

test("decryptSecret returns empty string on tampered ciphertext", () => {
  const stored = encryptSecret("secret");
  const tampered = stored.slice(0, -4) + "AAAA";
  assert.equal(decryptSecret(tampered), "");
});

test("password hashing verifies the right password and rejects the wrong one", () => {
  const hash = hashPassword("correct horse battery");
  assert.ok(verifyPassword("correct horse battery", hash));
  assert.ok(!verifyPassword("wrong password", hash));
  assert.ok(!verifyPassword("correct horse battery", "garbage"));
});

test("session tokens verify and carry the user id", () => {
  const { value } = createSessionToken(42);
  assert.equal(verifySessionToken(value), 42);
});

test("session tokens reject tampering and expiry", () => {
  const { value } = createSessionToken(42);
  const [uid, expiry, mac] = value.split(".");
  assert.equal(verifySessionToken(`999.${expiry}.${mac}`), null); // altered uid
  assert.equal(verifySessionToken(`${uid}.${expiry}.${"0".repeat(mac.length)}`), null); // bad mac
  assert.equal(verifySessionToken(undefined), null);
  assert.equal(verifySessionToken("not-a-token"), null);

  const past = String(Date.now() - 1000);
  // forged expiry without a valid signature must fail
  assert.equal(verifySessionToken(`${uid}.${past}.${mac}`), null);
});

test("email tokens store only a hash of the raw value", () => {
  const { raw, hash } = createEmailToken();
  assert.equal(hash, hashEmailToken(raw));
  assert.notEqual(raw, hash);
  assert.equal(raw.length, 64); // 32 random bytes, hex
  assert.notEqual(createEmailToken().raw, raw); // unique per call
});
