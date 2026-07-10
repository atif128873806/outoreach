import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Papa from "papaparse";
import { q, getDb, type Contact } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { normalizeLinkedin } from "@/lib/leads";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const search = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  let contacts: Contact[];
  if (search) {
    const like = `%${search}%`;
    contacts = await q<Contact>(
      `SELECT * FROM contacts WHERE user_id = $1 AND
         (email ILIKE $2 OR business_name ILIKE $2 OR category ILIKE $2
          OR instagram ILIKE $2 OR linkedin ILIKE $2)
       ORDER BY id DESC`,
      [userId, like]
    );
  } else {
    contacts = await q<Contact>(
      "SELECT * FROM contacts WHERE user_id = $1 ORDER BY id DESC",
      [userId]
    );
  }

  const categories = (
    await q<{ category: string }>(
      "SELECT DISTINCT category FROM contacts WHERE user_id = $1 AND category != '' ORDER BY category",
      [userId]
    )
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

const UPSERT_SQL = `INSERT INTO contacts (user_id, email, business_name, category, website, instagram, linkedin, phone, notes, unsub_token)
 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
 ON CONFLICT (user_id, email) DO UPDATE SET
   business_name = CASE WHEN EXCLUDED.business_name != '' THEN EXCLUDED.business_name ELSE contacts.business_name END,
   category      = CASE WHEN EXCLUDED.category != '' THEN EXCLUDED.category ELSE contacts.category END,
   website       = CASE WHEN EXCLUDED.website != '' THEN EXCLUDED.website ELSE contacts.website END,
   instagram     = CASE WHEN EXCLUDED.instagram != '' THEN EXCLUDED.instagram ELSE contacts.instagram END,
   linkedin      = CASE WHEN EXCLUDED.linkedin != '' THEN EXCLUDED.linkedin ELSE contacts.linkedin END,
   phone         = CASE WHEN EXCLUDED.phone != '' THEN EXCLUDED.phone ELSE contacts.phone END,
   notes         = CASE WHEN EXCLUDED.notes != '' THEN EXCLUDED.notes ELSE contacts.notes END`;

export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // Manual single-contact add
  if (payload.contact) {
    const c = payload.contact;
    const email = (c.email ?? "").trim().toLowerCase();
    if (!VALID_EMAIL.test(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    await q(UPSERT_SQL, [
      userId,
      email,
      (c.business_name ?? "").trim(),
      (c.category ?? "").trim(),
      (c.website ?? "").trim(),
      normalizeInstagram(c.instagram ?? ""),
      normalizeLinkedin(c.linkedin ?? ""),
      (c.phone ?? "").trim(),
      (c.notes ?? "").trim(),
      crypto.randomBytes(16).toString("hex"),
    ]);
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

  const db = await getDb();
  await db.transaction(async (tx) => {
    for (const row of parsed.data) {
      const email = pick(row, EMAIL_KEYS).toLowerCase();
      if (!VALID_EMAIL.test(email)) {
        skipped++;
        continue;
      }
      await tx.query(UPSERT_SQL, [
        userId,
        email,
        pick(row, NAME_KEYS),
        pick(row, CATEGORY_KEYS),
        pick(row, WEBSITE_KEYS),
        normalizeInstagram(pick(row, INSTAGRAM_KEYS)),
        normalizeLinkedin(pick(row, LINKEDIN_KEYS)),
        pick(row, PHONE_KEYS),
        pick(row, NOTES_KEYS),
        crypto.randomBytes(16).toString("hex"),
      ]);
      imported++;
    }
  });

  return NextResponse.json({ imported, skipped });
}
