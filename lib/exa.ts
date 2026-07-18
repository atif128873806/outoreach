/**
 * Web-wide company search via Exa's public MCP endpoint (https://mcp.exa.ai/mcp).
 *
 * Exa's `category:company` semantic search returns company profiles that often
 * already include emails, phones, and addresses — richer than map data, and it
 * finds businesses that aren't on any map (agencies, online stores, SaaS).
 * Free, no API key. Integration approach borrowed from the agent-reach project
 * (https://github.com/Panniantong/agent-reach).
 */

import { extractEmails, extractInstagram, extractPhone, normalizeLinkedin, type Lead } from "./leads";

const EXA_MCP_URL = "https://mcp.exa.ai/mcp";

/** Result hosts that are platforms/directories, not a business's own site. */
const JUNK_HOSTS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "tiktok.com",
  "wikipedia.org",
  "yelp.com",
  "tripadvisor.com",
  "yellowpages.com",
  "reddit.com",
  "medium.com",
  "quora.com",
  "glassdoor.com",
  "indeed.com",
  "crunchbase.com",
  "trustpilot.com",
  "google.com",
  "amazon.com",
];

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isJunkHost(host: string): boolean {
  return JUNK_HOSTS.some((j) => host === j || host.endsWith(`.${j}`));
}

/** Calls a tool on the Exa MCP server and returns its text content. */
async function exaMcpCall(
  tool: string,
  args: Record<string, unknown>
): Promise<string> {
  const res = await fetch(EXA_MCP_URL, {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });
  if (!res.ok) {
    throw new Error(`Web search failed (${res.status}) — try again in a minute`);
  }

  // The endpoint answers as plain JSON or as an SSE stream, depending on mood.
  const raw = (await res.text()).trim();
  interface RpcReply {
    error?: { message?: string };
    result?: { isError?: boolean; content?: { type: string; text?: string }[] };
  }
  let reply: RpcReply | undefined;
  if (raw.startsWith("{")) {
    reply = JSON.parse(raw) as RpcReply;
  } else {
    for (const line of raw.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try {
        const candidate = JSON.parse(line.slice(5).trim()) as RpcReply;
        if (candidate.result || candidate.error) {
          reply = candidate;
          break;
        }
      } catch {
        // partial/keepalive data line — keep looking
      }
    }
  }
  if (!reply) throw new Error("Web search returned an unreadable response");
  if (reply.error) {
    throw new Error(`Web search error: ${reply.error.message ?? "unknown"}`);
  }
  const text = reply.result?.content?.find((c) => c.type === "text")?.text ?? "";
  if (reply.result?.isError) {
    throw new Error(`Web search error: ${text.slice(0, 200) || "unknown"}`);
  }
  return text;
}

/** Pulls a "Field: value" line (with or without a leading list dash). */
function field(entry: string, name: string): string {
  const m = entry.match(new RegExp(`^[-*\\s]*${name}:[ \\t]*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
}

/**
 * Pulls the narrative description out of a company profile block — the prose
 * about what the business does, its size and founding. Imported into the
 * contact's notes, it gives the AI real material to personalize with.
 */
function extractDescription(entry: string): string {
  const afterHighlights = entry.split(/^Highlights:\s*$/m)[1] ?? entry;
  const parts: string[] = [];
  for (const line of afterHighlights.split("\n")) {
    const t = line.trim();
    if (!t || t === "..." || t === "…") continue;
    if (/^[-*#\[!>|]/.test(t)) continue; // field lists, headings, images, quotes
    if (/^(Title|URL|Published|Author):/i.test(t)) continue;
    if (t.length < 40) continue; // fragments
    parts.push(t);
    if (parts.join(" ").length > 260) break;
  }
  let out = parts.join(" ").replace(/\s+/g, " ");
  if (out.length > 300) out = out.slice(0, 297).trimEnd() + "…";
  return out;
}

/**
 * Searches the web for companies matching a niche + location. Results come
 * back as one text blob of profile blocks separated by `---`; each block is
 * parsed into a Lead. Many already carry an email, so enrichment only has to
 * fill the gaps.
 */
export async function searchExaCompanies(
  niche: string,
  location: string,
  count: number
): Promise<Lead[]> {
  const query = `category:company ${niche.trim()} in ${location.trim()}`;
  const text = await exaMcpCall("web_search_exa", {
    query,
    numResults: Math.min(count * 2 + 5, 50),
  });

  const seen = new Set<string>();
  const leads: Lead[] = [];

  for (const entry of text.split(/\n-{3,}\n/)) {
    const name = field(entry, "Title");
    const url = field(entry, "URL");
    if (!name || !url) continue;

    const host = hostOf(url);
    if (!host || isJunkHost(host) || seen.has(host)) continue;
    seen.add(host);

    // Prefer the profile's explicit Emails field; fall back to scanning the block.
    const emailField = field(entry, "Emails?");
    const emails = extractEmails(emailField || entry);

    const homepage = field(entry, "Homepage");
    const website = homepage
      ? homepage.startsWith("http")
        ? homepage
        : `https://${homepage}`
      : url;

    leads.push({
      business_name: name,
      category: niche.trim(),
      website,
      phone: (field(entry, "Phone").split(/[,;]/)[0] ?? "").trim(),
      email: emails[0] ?? "",
      instagram: extractInstagram(entry),
      linkedin: normalizeLinkedin(field(entry, "LinkedIn")),
      address: field(entry, "Headquarters") || field(entry, "Address"),
      notes: extractDescription(entry),
      source: "web_search",
    });
  }

  // Leads that already have contact info first, same as the other sources.
  leads.sort(
    (a, b) =>
      Number(Boolean(b.email)) * 4 + Number(Boolean(b.website)) * 2 + Number(Boolean(b.instagram)) -
      (Number(Boolean(a.email)) * 4 + Number(Boolean(a.website)) * 2 + Number(Boolean(a.instagram)))
  );
  return leads;
}

// ---------- decision-maker finder (category:people) ----------

export interface PersonCandidate {
  name: string;
  /** LinkedIn path, e.g. "in/janedoe" */
  linkedin: string;
  role: string;
  /** true when the role looks like owner/founder/C-level */
  isOwner: boolean;
}

const OWNER_RE = /\b(owner|founder|co-?founder|ceo|president|managing director|principal|proprietor)\b/i;

/**
 * Finds the people behind a business via Exa's LinkedIn people search.
 * Returns candidates ranked owner-ish roles first — results can include
 * employees or alumni, so the user picks which one to attach.
 */
export async function searchExaPeople(
  businessName: string,
  location: string
): Promise<PersonCandidate[]> {
  const query = `category:people founder or owner of ${businessName}${location ? ` ${location}` : ""}`;
  const text = await exaMcpCall("web_search_exa", { query, numResults: 6 });

  const seen = new Set<string>();
  const candidates: PersonCandidate[] = [];

  for (const entry of text.split(/\n-{3,}\n/)) {
    const name = field(entry, "Title");
    const url = field(entry, "URL");
    if (!name || !/linkedin\.com\/in\//i.test(url)) continue;

    const linkedin = normalizeLinkedinPerson(url);
    if (!linkedin || seen.has(linkedin)) continue;
    seen.add(linkedin);

    // Role lines look like "### <Role> - [Company](…)" or "<Role> at <Company>"
    let role = "";
    const heading = entry.match(/^#{2,4}\s+(.{3,70}?)\s+-\s+\[/m);
    if (heading) role = heading[1].trim();
    if (!role) {
      const atLine = entry.match(/^([A-Z][^\n]{3,60}?) at [A-Z][^\n]{2,50}$/m);
      if (atLine) role = atLine[1].trim();
    }

    candidates.push({
      name,
      linkedin,
      role,
      isOwner: OWNER_RE.test(role) || OWNER_RE.test(entry.slice(0, 600)),
    });
  }

  candidates.sort((a, b) => Number(b.isOwner) - Number(a.isOwner));
  return candidates.slice(0, 4);
}

/** People URLs must keep the in/ form (normalizeLinkedin assumes company for bare handles). */
function normalizeLinkedinPerson(url: string): string {
  const m = url.match(/linkedin\.com\/(in\/[a-zA-Z0-9\-_.%]{2,60})/i);
  return m ? m[1] : "";
}

// ---------- offline-business contact hunt ----------

/**
 * A business with no website usually still has a public footprint — an
 * Instagram page, a directory listing with a phone, sometimes an email.
 * One web search per business digs those up so offline leads become
 * actually reachable (IG DM campaigns / calls).
 */
export async function findOfflineContact(
  businessName: string,
  location: string
): Promise<{ instagram: string; phone: string; email: string }> {
  try {
    const text = await exaMcpCall("web_search_exa", {
      query: `"${businessName}" ${location} instagram contact phone`,
      numResults: 5,
    });
    return {
      instagram: extractInstagram(text),
      phone: extractPhone(text),
      email: extractEmails(text)[0] ?? "",
    };
  } catch {
    return { instagram: "", phone: "", email: "" }; // best-effort — never fail the search
  }
}
