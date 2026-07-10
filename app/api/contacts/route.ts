import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Papa from "papaparse";
import { getDb, type Contact } from "@/lib/db";
import { normalizeLinkedin } from "@/lib/leads";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const db = getDb();
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  let contacts: Contact[];
  if (q) {
    const like = `%${q}%`;
    contacts = db
      .prepare(
        "SELECT * FROM contacts WHERE email LIKE ? OR business_name LIKE ? OR category LIKE ? OR instagram LIKE ? OR linkedin LIKE ? ORDER BY id DESC"
      )
      .all(like, like, like, like, like) as Contact[];
  } else {
    contacts = db
      .prepare("SELECT * FROM contacts ORDER BY id DESC")
      .all() as Contact[];
  }

  const categories = (
    db
      .prepare(
        "SELECT DISTINCT category FROM contacts WHERE category != '' ORDER BY category"
      )
      .all() as { category: string }[]
  ).map((r) => r.category);

  return NextResponse.json({ contacts, categories });
}

// Header aliases so real-world CSV exports map without manual work
const EMAIL_KEYS = ["email", "email address", "e-mail", "mail"];
const NAME_KEYS = ["business_name", "business name", "business", "company", "company name", "name", "organization"];
const CATEGORY_KEYS = ["category", "type", "industry", "niche", "sector"];
const WEBSITE_KEYS = ["website", "url", "site", "web", "domain"];
const INSTAGRAM_KEYS = ["instagram", "instagram handle", "ig", "insta", "instagram_url", "instagram url"];
const LINKEDIN_KEYS = ["linkedin", "linkedin url", "linkedin_url", "linkedin profile", "li"];
const PHONE_KEYS = ["phone", "phone number", "mobile", "tel", "telephone", "whatsapp"];
const NOTES_KEYS = ["notes", "note", "comments", "description"];

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of Object.keys(row)) {
    if (keys.includes(k.trim().toLowerCase())) {
      const v = (row[k] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

function normalizeInstagram(v: string): string {
  return v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?].*$/, "");
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const UPSERT_SQL = `INSERT INTO contacts (email, business_name, category, website, instagram, linkedin, phone, notes, unsub_token)
 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
 ON CONFLICT(email) DO UPDATE SET
   business_name = CASE WHEN excluded.business_name != '' THEN excluded.business_name ELSE contacts.business_name END,
   category      = CASE WHEN excluded.category != '' THEN excluded.category ELSE contacts.category END,
   website       = CASE WHEN excluded.website != '' THEN excluded.website ELSE contacts.website END,
   instagram     = CASE WHEN excluded.instagram != '' THEN excluded.instagram ELSE contacts.instagram END,
   linkedin      = CASE WHEN excluded.linkedin != '' THEN excluded.linkedin ELSE contacts.linkedin END,
   phone         = CASE WHEN excluded.phone != '' THEN excluded.phone ELSE contacts.phone END,
   notes         = CASE WHEN excluded.notes != '' THEN excluded.notes ELSE contacts.notes END`;

export async function POST(req: NextRequest) {
  const payload = (await req.json()) as {
    csv?: string;
    contact?: {
      email?: string;
      business_name?: string;
      category?: string;
      website?: string;
      instagram?: string;
      linkedin?: string;
      phone?: string;
      notes?: string;
    };
  };

  const db = getDb();
  const upsert = db.prepare(UPSERT_SQL);

  // Manual single-contact add
  if (payload.contact) {
    const c = payload.contact;
    const email = (c.email ?? "").trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    upsert.run(
      email,
      (c.business_name ?? "").trim(),
      (c.category ?? "").trim(),
      (c.website ?? "").trim(),
      normalizeInstagram(c.instagram ?? ""),
      normalizeLinkedin(c.linkedin ?? ""),
      (c.phone ?? "").trim(),
      (c.notes ?? "").trim(),
      crypto.randomBytes(16).toString("hex")
    );
    return NextResponse.json({ imported: 1, skipped: 0 });
  }

  // CSV import
  if (!payload.csv?.trim()) {
    return NextResponse.json({ error: "No CSV content provided" }, { status: 400 });
  }

  const parsed = Papa.parse<Record<string, string>>(payload.csv, {
    header: true,
    skipEmptyLines: true,
  });

  let imported = 0;
  let skipped = 0;

  const tx = db.transaction((rows: Record<string, string>[]) => {
    for (const row of rows) {
      const email = pick(row, EMAIL_KEYS).toLowerCase();
      if (!VALID_EMAIL.test(email)) {
        skipped++;
        continue;
      }
      upsert.run(
        email,
        pick(row, NAME_KEYS),
        pick(row, CATEGORY_KEYS),
        pick(row, WEBSITE_KEYS),
        normalizeInstagram(pick(row, INSTAGRAM_KEYS)),
        normalizeLinkedin(pick(row, LINKEDIN_KEYS)),
        pick(row, PHONE_KEYS),
        pick(row, NOTES_KEYS),
        crypto.randomBytes(16).toString("hex")
      );
      imported++;
    }
  });
  tx(parsed.data);

  return NextResponse.json({ imported, skipped });
}
