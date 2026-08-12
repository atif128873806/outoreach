import { test } from "node:test";
import assert from "node:assert/strict";

const { oneClickUnsubscribeOptions } = await import("../lib/compliance.ts");

test("campaign mail includes both RFC 8058 one-click unsubscribe headers", () => {
  const url = "https://example.com/api/unsubscribe?token=abc123";
  assert.deepEqual(oneClickUnsubscribeOptions(url), {
    list: { unsubscribe: { url, comment: "Unsubscribe" } },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  assert.deepEqual(oneClickUnsubscribeOptions(""), {});
});
