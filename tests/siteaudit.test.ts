import { test } from "node:test";
import assert from "node:assert/strict";

const { auditWebsiteHtml, extractPhone } = await import("../lib/leads.ts");

const MODERN = `<!doctype html><html><head><meta name="viewport" content="width=device-width">
<title>Acme</title></head><body>${"real content ".repeat(200)}
<footer>© ${new Date().getFullYear()} Acme</footer></body></html>`;

test("a modern site gets no flags", () => {
  assert.deepEqual(auditWebsiteHtml(MODERN, "https://acme.com"), []);
});

test("no viewport meta → not mobile-friendly", () => {
  const html = `<html><head><title>Old</title></head><body>${"x ".repeat(2000)}</body></html>`;
  const flags = auditWebsiteHtml(html, "https://old-site.com");
  assert.ok(flags.some((f) => f.includes("mobile-friendly")));
});

test("http:// url → no-HTTPS flag", () => {
  const flags = auditWebsiteHtml(MODERN, "http://acme.com");
  assert.ok(flags.some((f) => f.includes("HTTPS")));
});

test("free-builder hosting is flagged", () => {
  const flags = auditWebsiteHtml(MODERN, "https://myshop.wixsite.com/home");
  assert.ok(flags.some((f) => f.includes("free builder")));
  const fb = auditWebsiteHtml(MODERN, "https://www.facebook.com/myshop");
  assert.ok(fb.some((f) => f.includes("free builder")));
});

test("stale copyright year is flagged; recent is not", () => {
  const old = MODERN.replace(`© ${new Date().getFullYear()}`, "© 2016");
  assert.ok(auditWebsiteHtml(old, "https://a.com").some((f) => f.includes("2016")));
  assert.ok(!auditWebsiteHtml(MODERN, "https://a.com").some((f) => f.includes("copyright")));
});

test("2000s-era markup is flagged", () => {
  const html = MODERN.replace("<body>", "<body><marquee>WELCOME</marquee>");
  assert.ok(auditWebsiteHtml(html, "https://a.com").some((f) => f.includes("2000s-era")));
});

test("empty html only yields url-based flags", () => {
  assert.deepEqual(auditWebsiteHtml("", "https://acme.com"), []);
  assert.ok(auditWebsiteHtml("", "http://acme.com").length === 1);
});

test("extractPhone prefers international formats and rejects long IDs", () => {
  const text = "id 680305583769994 call +92 336 4486193 or 042-35714286 today";
  assert.equal(extractPhone(text), "+92 336 4486193");
  assert.equal(extractPhone("no numbers here"), "");
  assert.equal(extractPhone("year 2016 2020 2024"), "");
});
