import { test } from "node:test";
import assert from "node:assert/strict";

const { safeFetchUrlReject } = await import("../lib/safe-url.ts");

test("ordinary business addresses are allowed", () => {
  assert.equal(safeFetchUrlReject("https://example.com"), null);
  assert.equal(safeFetchUrlReject("http://www.markthompsonheating.com/contact"), null);
  assert.equal(safeFetchUrlReject("oldroydgroup.co.uk"), null); // no scheme
  assert.equal(safeFetchUrlReject("https://8.8.8.8/"), null); // public literal
});

test("the server refuses to fetch its own network", () => {
  // This endpoint takes a URL from a user, so it is the one place where an
  // address could point back at the machine running it.
  for (const url of [
    "http://localhost:3000/admin",
    "http://127.0.0.1:5432/",
    "http://localhost./",
    "http://app.localhost/",
    "https://box.internal/",
    "http://printer.local/",
    "http://10.0.0.5/",
    "http://172.16.4.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/", // cloud metadata
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
  ]) {
    assert.notEqual(safeFetchUrlReject(url), null, `${url} should be refused`);
  }
});

test("only web addresses are fetchable at all", () => {
  assert.notEqual(safeFetchUrlReject("file:///etc/passwd"), null);
  assert.notEqual(safeFetchUrlReject("ftp://example.com/x"), null);
  assert.notEqual(safeFetchUrlReject("javascript:alert(1)"), null);
  assert.notEqual(safeFetchUrlReject("  "), null);
});

test("a refusal explains itself, and a mangled address is not fetched", () => {
  assert.match(String(safeFetchUrlReject("http://localhost/")), /own network/i);
  assert.match(String(safeFetchUrlReject("http://10.1.2.3/")), /private network/i);
  assert.match(String(safeFetchUrlReject("not a url")), /not a web address/i);
});
