import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { resolveRelativeTs } from "./helpers/resolve-ts.mjs";

const hooks = resolveRelativeTs();
const { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } = await import("../lib/system-mailer.ts");

test("transactional onboarding follows the selected product without real delivery", async t => {
  const keys = ["SYSTEM_SMTP_HOST", "SYSTEM_SMTP_USER", "SYSTEM_SMTP_PASS", "SYSTEM_FROM_NAME", "APP_URL", "OUTREACH_ENABLED"];
  const before = new Map(keys.map(key => [key, process.env[key]]));
  const createTransport = nodemailer.createTransport;
  const messages: { subject: string; text: string; html: string; from: string }[] = [];
  nodemailer.createTransport = (() => ({
    sendMail: async (message: typeof messages[number]) => { messages.push(message); return {}; },
  })) as typeof nodemailer.createTransport;
  process.env.SYSTEM_SMTP_HOST = "smtp.example.test";
  process.env.SYSTEM_SMTP_USER = "fixture@example.test";
  process.env.SYSTEM_SMTP_PASS = "fixture-only";
  process.env.APP_URL = "https://example.test";
  delete process.env.SYSTEM_FROM_NAME;
  delete process.env.OUTREACH_ENABLED;
  t.after(() => {
    nodemailer.createTransport = createTransport;
    for (const [key, value] of before) { if (value == null) delete process.env[key]; else process.env[key] = value; }
    hooks.deregister();
  });

  await t.test("default welcome links to lead search and describes available evidence", async () => {
    await sendWelcomeEmail("fixture@example.test", "<b>Fixture</b>");
    const message = messages.at(-1)!;
    assert.equal(message.subject, "Welcome to LeadBoffin");
    assert.match(message.from, /LeadBoffin/);
    assert.match(message.text, /business shortlist/);
    assert.match(message.html, /https:\/\/example\.test\/leads/);
    assert.match(message.html, /&lt;b&gt;Fixture&lt;\/b&gt;/);
    assert.doesNotMatch(message.text + message.html, /campaign|smtp|mailbox|AI writing|unlock sending|\/dashboard/i);
  });
  await t.test("verification and password-reset emails use the new account identity", async () => {
    await sendVerificationEmail("fixture@example.test", "Fixture", "https://example.test/verify?token=fixture");
    await sendPasswordResetEmail("fixture@example.test", "Fixture", "https://example.test/reset?token=fixture");
    assert.match(messages.at(-2)!.subject, /LeadBoffin/);
    assert.match(messages.at(-1)!.subject, /LeadBoffin/);
    assert.doesNotMatch(messages.at(-2)!.text + messages.at(-2)!.html, /unlock sending/i);
    assert.match(messages.at(-1)!.text, /60 minutes/);
  });
  await t.test("optional verification keeps its real link without offering hidden features", async () => {
    await sendWelcomeEmail("fixture@example.test", "Fixture", "https://example.test/verify?token=fixture");
    assert.match(messages.at(-1)!.html, /https:\/\/example\.test\/verify\?token=fixture/);
    assert.doesNotMatch(messages.at(-1)!.html, /campaign|AI writing|unlock sending/i);
  });
  await t.test("explicit outreach mode retains the campaign workflow and landing route", async () => {
    process.env.OUTREACH_ENABLED = "true";
    await sendWelcomeEmail("fixture@example.test", "Fixture");
    assert.match(messages.at(-1)!.text, /campaign/);
    assert.match(messages.at(-1)!.html, /https:\/\/example\.test\/dashboard/);
  });
  await t.test("missing app URL does not generate a broken landing link", async () => {
    delete process.env.OUTREACH_ENABLED;
    delete process.env.APP_URL;
    await sendWelcomeEmail("fixture@example.test", "Fixture");
    assert.doesNotMatch(messages.at(-1)!.html, /href="(?:undefined|your dashboard|\/leads)"/);
  });
});
