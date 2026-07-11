import { test } from "node:test";
import assert from "node:assert/strict";

const { rateLimit, clientIp } = await import("../lib/ratelimit.ts");

test("rateLimit allows up to the limit, then blocks within the window", () => {
  const key = `t-${Math.random()}`;
  assert.ok(rateLimit(key, 3, 60_000));
  assert.ok(rateLimit(key, 3, 60_000));
  assert.ok(rateLimit(key, 3, 60_000));
  assert.ok(!rateLimit(key, 3, 60_000)); // 4th call blocked
});

test("rateLimit resets after the window elapses", () => {
  const key = `t-${Math.random()}`;
  assert.ok(rateLimit(key, 1, 1)); // 1ms window
  const start = Date.now();
  while (Date.now() - start < 5) {
    /* let the window expire */
  }
  assert.ok(rateLimit(key, 1, 60_000));
});

test("rateLimit tracks keys independently", () => {
  const a = `a-${Math.random()}`;
  const b = `b-${Math.random()}`;
  assert.ok(rateLimit(a, 1, 60_000));
  assert.ok(!rateLimit(a, 1, 60_000));
  assert.ok(rateLimit(b, 1, 60_000)); // other key unaffected
});

test("clientIp prefers the first x-forwarded-for hop", () => {
  const req = new Request("http://x", {
    headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
  });
  assert.equal(clientIp(req), "203.0.113.9");
});

test("clientIp falls back to x-real-ip, then 'local'", () => {
  assert.equal(
    clientIp(new Request("http://x", { headers: { "x-real-ip": "198.51.100.2" } })),
    "198.51.100.2"
  );
  assert.equal(clientIp(new Request("http://x")), "local");
});
