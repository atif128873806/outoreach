import { test } from "node:test";
import assert from "node:assert/strict";

const { templateLinkedin } = await import("../lib/templates.ts");

const settings = {
  sender_name: "Atif Mumtaz",
  company_name: "SakoDev Digital Solutions",
  sender_role: "Founder & Lead Developer",
} as never;

const campaign = {
  description:
    "We build fast, modern websites for local businesses. " +
    "Most local sites load slowly and lose customers before the page even renders — " +
    "we fix that with a rebuild that pays for itself in bookings.",
  tone: "professional",
  channel: "linkedin",
} as never;

function contact(id: number, name: string) {
  return {
    id,
    business_name: name,
    category: "real estate agency",
  } as never;
}

test("linkedin step 1 is a connection note within LinkedIn's 200-char cap", () => {
  // Every rotation seed and even long business names must stay inside the cap.
  for (let id = 1; id <= 6; id++) {
    const r = templateLinkedin(
      contact(id, "Extraordinarily Long Business Name Realty & Property Management LLC"),
      campaign,
      settings,
      1
    );
    assert.equal(r.subject, "");
    assert.ok(r.body.length <= 200, `seed ${id}: ${r.body.length} chars`);
    assert.ok(r.body.length > 0);
  }
});

test("linkedin later steps are full DMs, not connection notes", () => {
  const note = templateLinkedin(contact(1, "Bright Smile Dental"), campaign, settings, 1);
  const dm = templateLinkedin(contact(1, "Bright Smile Dental"), campaign, settings, 2);
  assert.ok(dm.body.length > note.body.length);
  assert.ok(dm.body.includes("websites") || dm.body.includes("rebuild"));
});
