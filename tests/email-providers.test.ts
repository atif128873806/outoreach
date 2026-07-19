import { test } from "node:test";
import assert from "node:assert/strict";

const { classifyMx, PROVIDER_PRESETS, resolvePreset } = await import("../lib/email-providers.ts");

test("classifyMx maps real-world MX hosts to the right provider", () => {
  assert.equal(classifyMx(["aspmx.l.google.com", "alt1.aspmx.l.google.com"]), "google");
  assert.equal(classifyMx(["acme-com.mail.protection.outlook.com"]), "microsoft365");
  assert.equal(classifyMx(["outlook-com.olc.protection.outlook.com"]), "outlook-personal");
  assert.equal(classifyMx(["mx.zoho.com", "mx2.zoho.com"]), "zoho");
  assert.equal(classifyMx(["mta7.am0.yahoodns.net"]), "yahoo");
  assert.equal(classifyMx(["mx1.privateemail.com"]), "privateemail");
  assert.equal(classifyMx(["mx1.hostinger.com"]), "hostinger");
  assert.equal(classifyMx(["smtp.secureserver.net"]), "godaddy");
  assert.equal(classifyMx(["server318-2.web-hosting.com"]), "cpanel");
  assert.equal(classifyMx(["mail.some-unknown-host.io"]), "generic");
});

test("every preset is complete and consistent", () => {
  for (const p of Object.values(PROVIDER_PRESETS)) {
    assert.ok(p.smtp.host && p.smtp.port && p.imap.host && p.imap.port, p.id);
    assert.ok(["true", "false"].includes(p.smtp.secure), p.id);
    // port/secure combos must agree (465↔SSL, 587↔STARTTLS)
    if (p.smtp.port === "465") assert.equal(p.smtp.secure, "true", p.id);
    if (p.smtp.port === "587") assert.equal(p.smtp.secure, "false", p.id);
    assert.ok(p.guide.length > 0, p.id);
  }
});

test("resolvePreset fills the {domain} token", () => {
  const cpanel = resolvePreset(PROVIDER_PRESETS.cpanel, "info@acme.com");
  assert.equal(cpanel.smtp.host, "mail.acme.com");
  assert.equal(cpanel.imap.host, "mail.acme.com");
  // fixed-host presets are untouched
  const g = resolvePreset(PROVIDER_PRESETS.google, "x@gmail.com");
  assert.equal(g.smtp.host, "smtp.gmail.com");
});
