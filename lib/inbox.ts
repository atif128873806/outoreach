import { ImapFlow } from "imapflow";
import { q, q1 } from "./db";
import {
  getImapConfig,
  getSettings,
  getKv,
  setKv,
  type Settings,
  type ImapConfig,
} from "./settings";
import { analyzeReply } from "./ai";

/**
 * Reply & bounce detection, per user. Polls each user's IMAP inbox for
 * messages that arrived since the last check:
 *  - a message from a known contact          → mark the contact replied
 *  - a bounce notice (mailer-daemon)         → mark the affected contact bounced
 *
 * Replied contacts stop receiving follow-ups; bounced contacts stop receiving
 * everything (protects sender reputation).
 */

const BOUNCE_FROM = /mailer-daemon|postmaster|mail delivery|mailer@/i;
const BOUNCE_SUBJECT = /undeliver|delivery status|delivery failure|failure notice|returned mail|delivery has failed/i;

export interface InboxCheckResult {
  ok: boolean;
  checked: number;
  replies: number;
  bounces: number;
  error?: string;
}

async function streamToString(stream: NodeJS.ReadableStream, maxBytes = 200_000): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    size += buf.length;
    if (size >= maxBytes) break;
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Pulls readable reply text out of a raw RFC822 message: decodes the most
 * likely text part, strips HTML tags, quoted history, and signatures.
 * Crude by design — the result feeds classification, not display fidelity.
 */
export function extractReplyText(source: string): string {
  // Body = everything after the first blank line (skipping top-level headers)
  let body = source.split(/\r?\n\r?\n/).slice(1).join("\n\n");

  // Multipart: prefer the text/plain part
  const plainMatch = body.match(
    /content-type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?=\r?\n--|$)/i
  );
  if (plainMatch) body = plainMatch[1];

  // Quoted-printable: soft line breaks, then byte-accurate decode (UTF-8 aware)
  body = body.replace(/=\r?\n/g, "");
  if (/=[0-9A-F]{2}/i.test(body)) {
    const bytes: number[] = [];
    for (let i = 0; i < body.length; i++) {
      const hex = body.slice(i + 1, i + 3);
      if (body[i] === "=" && /^[0-9A-F]{2}$/i.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
      } else {
        bytes.push(body.charCodeAt(i) & 0xff);
      }
    }
    body = Buffer.from(bytes).toString("utf8");
  }

  // If what's left is HTML, strip tags
  if (/<[a-z][\s\S]*>/i.test(body)) {
    body = body
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  // Drop quoted history and the usual reply markers
  const lines: string[] = [];
  for (const line of body.split("\n")) {
    const t = line.trim();
    if (t.startsWith(">")) continue;
    if (/^On .{5,80} wrote:$/.test(t)) break;
    if (/^-{2,}\s*Original Message/i.test(t)) break;
    if (/^_{5,}$/.test(t)) break;
    lines.push(line);
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Checks every user that has IMAP configured. */
export async function checkAllInboxes(): Promise<void> {
  const users = await q<{ id: number }>("SELECT id FROM users ORDER BY id");
  for (const user of users) {
    const settings = await getSettings(user.id);
    const cfg = getImapConfig(settings);
    if (!cfg) continue;
    const result = await checkInbox(user.id, settings, cfg);
    if (result.ok && (result.replies > 0 || result.bounces > 0)) {
      console.log(
        `[inbox] user #${user.id}: ${result.replies} new repl${result.replies === 1 ? "y" : "ies"}, ${result.bounces} bounce(s)`
      );
    }
  }
}

export async function checkInbox(
  userId: number,
  settings?: Settings,
  imap?: ImapConfig
): Promise<InboxCheckResult> {
  const s = settings ?? (await getSettings(userId));
  const cfg = imap ?? getImapConfig(s);
  if (!cfg) {
    return { ok: false, checked: 0, replies: 0, bounces: 0, error: "IMAP not configured" };
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.pass },
    logger: false,
  });

  let checked = 0;
  let replies = 0;
  let bounces = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const mailbox = client.mailbox;
      const uidNext = typeof mailbox === "object" && mailbox ? mailbox.uidNext : 1;
      const lastUid = parseInt((await getKv(userId, "imap_last_uid")) || "0", 10);

      if (!lastUid) {
        // First run: don't trawl through history — start from now.
        await setKv(userId, "imap_last_uid", String((uidNext ?? 1) - 1));
        await setKv(userId, "imap_last_check", new Date().toISOString());
        await setKv(userId, "imap_last_error", "");
        return { ok: true, checked: 0, replies: 0, bounces: 0 };
      }

      const bounceCandidates: number[] = [];
      const replyCandidates: {
        uid: number;
        contactId: number;
        fromAddr: string;
        subject: string;
        businessName: string;
      }[] = [];
      let maxUid = lastUid;

      for await (const msg of client.fetch(
        `${lastUid + 1}:*`,
        { uid: true, envelope: true },
        { uid: true }
      )) {
        if (msg.uid <= lastUid) continue; // IMAP range quirk when no new mail
        maxUid = Math.max(maxUid, msg.uid);
        checked++;

        const from = msg.envelope?.from?.[0];
        const fromAddr = (from?.address ?? "").toLowerCase();
        const subject = msg.envelope?.subject ?? "";

        if (BOUNCE_FROM.test(fromAddr) || BOUNCE_FROM.test(from?.name ?? "") || BOUNCE_SUBJECT.test(subject)) {
          if (bounceCandidates.length < 20) bounceCandidates.push(msg.uid);
          continue;
        }

        if (!fromAddr) continue;
        const contact = await q1<{ id: number; replied: number; business_name: string }>(
          "SELECT id, replied, business_name FROM contacts WHERE user_id = $1 AND lower(email) = $2",
          [userId, fromAddr]
        );
        if (contact) {
          const hadSent = await q1(
            "SELECT 1 FROM emails WHERE contact_id = $1 AND status = 'sent' LIMIT 1",
            [contact.id]
          );
          if (hadSent) {
            if (!contact.replied) replies++;
            await q("UPDATE contacts SET replied = 1 WHERE id = $1", [contact.id]);
            await q(
              `UPDATE emails SET replied_at = now() WHERE id = (
                 SELECT id FROM emails WHERE contact_id = $1 AND status = 'sent' AND replied_at IS NULL
                 ORDER BY sent_at DESC LIMIT 1)`,
              [contact.id]
            );
            if (replyCandidates.length < 5) {
              replyCandidates.push({
                uid: msg.uid,
                contactId: contact.id,
                fromAddr,
                subject,
                businessName: contact.business_name,
              });
            }
            console.log(`[inbox] reply detected from ${fromAddr}`);
          }
        }
      }

      // Reply intelligence: read each reply, classify it, and (with an AI key)
      // draft a suggested response for the Message Center.
      for (const r of replyCandidates) {
        try {
          const { content } = await client.download(String(r.uid), undefined, { uid: true });
          if (!content) continue;
          const text = extractReplyText(await streamToString(content));
          if (!text) continue;
          const analysis = await analyzeReply(
            text,
            { business_name: r.businessName, email: r.fromAddr },
            s
          );
          await q(
            `INSERT INTO replies (user_id, contact_id, from_email, subject, snippet, classification, suggested_reply)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [userId, r.contactId, r.fromAddr, r.subject, text.slice(0, 600), analysis.classification, analysis.suggested_reply]
          );
          console.log(`[inbox] reply from ${r.fromAddr} classified as ${analysis.classification}`);
        } catch (err) {
          console.error(`[inbox] could not analyze reply from ${r.fromAddr}:`, err);
        }
      }

      // Bounce notices: download the message and look for one of our contacts inside.
      if (bounceCandidates.length > 0) {
        const contactEmails = (
          await q<{ email: string }>(
            "SELECT email FROM contacts WHERE user_id = $1 AND bounced = 0",
            [userId]
          )
        ).map((r) => r.email.toLowerCase());

        for (const uid of bounceCandidates) {
          try {
            const { content } = await client.download(String(uid), undefined, { uid: true });
            if (!content) continue;
            const source = (await streamToString(content)).toLowerCase();
            for (const email of contactEmails) {
              if (source.includes(email)) {
                const res = await q<{ id: number }>(
                  `UPDATE contacts SET bounced = 1
                   WHERE user_id = $1 AND lower(email) = $2 AND bounced = 0 RETURNING id`,
                  [userId, email]
                );
                if (res.length > 0) {
                  bounces++;
                  console.log(`[inbox] bounce detected for ${email}`);
                }
              }
            }
          } catch {
            // one unparseable bounce shouldn't stop the rest
          }
        }
      }

      await setKv(userId, "imap_last_uid", String(maxUid));
      await setKv(userId, "imap_last_check", new Date().toISOString());
      await setKv(userId, "imap_last_error", "");
    } finally {
      lock.release();
    }
    await client.logout();
    return { ok: true, checked, replies, bounces };
  } catch (err) {
    try {
      await client.logout();
    } catch {
      /* already closed */
    }
    const message = err instanceof Error ? err.message : String(err);
    await setKv(userId, "imap_last_error", message).catch(() => {});
    await setKv(userId, "imap_last_check", new Date().toISOString()).catch(() => {});
    console.error(`[inbox] user #${userId} check failed:`, message);
    return { ok: false, checked, replies, bounces, error: message };
  }
}
