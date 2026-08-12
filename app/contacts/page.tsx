"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Card,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "../components/ui";

interface Contact {
  id: number;
  email: string;
  business_name: string;
  category: string;
  website: string;
  instagram: string;
  linkedin: string;
  phone: string;
  notes: string;
  email_status: string;
  replied: number;
  bounced: number;
  unsubscribed: number;
  created_at: string;
}

const EMPTY_FORM = {
  email: "",
  business_name: "",
  category: "",
  website: "",
  instagram: "",
  linkedin: "",
  phone: "",
  notes: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (q = "") => {
    const res = await fetch(`/api/contacts?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setContacts(data.contacts);
    setCategories(data.categories);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 250);
    return () => clearTimeout(t);
  }, [query, load]);

  async function handleFile(file: File) {
    setImporting(true);
    setMessage(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMessage(
        `Imported ${data.imported} contact${data.imported === 1 ? "" : "s"}` +
          (data.skipped ? `, skipped ${data.skipped} row(s) without a valid email` : "")
      );
      await load(query);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function addContact() {
    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact: form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add contact");
      setForm(EMPTY_FORM);
      setShowAdd(false);
      await load(query);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not add contact");
    } finally {
      setAdding(false);
    }
  }

  async function toggleReplied(c: Contact) {
    await fetch(`/api/contacts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replied: !c.replied }),
    });
    await load(query);
  }

  async function remove(id: number) {
    if (!confirm("Delete this contact? Their message history will also be removed.")) return;
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    await load(query);
  }

  const setF = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Contacts"
        subtitle={`${contacts.length} contact${contacts.length === 1 ? "" : "s"}${
          categories.length ? ` across ${categories.length} categories` : ""
        }`}
        action={
          <div className="flex gap-2">
            <a
              className={btnSecondary}
              href={
                "data:text/csv;charset=utf-8," +
                encodeURIComponent(
                  "email,business_name,category,website,instagram,linkedin,phone,notes\ninfo@joespizza.com,Joe's Pizza,Restaurant,https://joespizza.com,joespizza_nyc,company/joes-pizza,+1 555 0100,Family-owned since 1985\nhello@brightsmile.com,Bright Smile Dental,Dental Clinic,,brightsmile.dental,,,\n"
                )
              }
              download="contacts-template.csv"
            >
              Download template
            </a>
            <button className={btnSecondary} onClick={() => setShowAdd((v) => !v)}>
              {showAdd ? "Close" : "+ Add manually"}
            </button>
            <button
              className={btnPrimary}
              onClick={() => fileRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing…" : "Import CSV"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>
        }
      />

      {message && (
        <Card className="mb-4 p-3 text-sm text-zinc-700 bg-zinc-50">{message}</Card>
      )}

      {showAdd && (
        <Card className="mb-4 p-5">
          <div className="grid md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="email (required)" value={form.email} onChange={setF("email")} />
            <input className={inputCls} placeholder="Business name" value={form.business_name} onChange={setF("business_name")} />
            <input className={inputCls} placeholder="Category (e.g. Restaurant)" value={form.category} onChange={setF("category")} list="cat-suggestions" />
            <datalist id="cat-suggestions">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
            <input className={inputCls} placeholder="Instagram handle or URL" value={form.instagram} onChange={setF("instagram")} />
            <input className={inputCls} placeholder="LinkedIn URL (company or profile)" value={form.linkedin} onChange={setF("linkedin")} />
            <input className={inputCls} placeholder="Phone" value={form.phone} onChange={setF("phone")} />
            <input className={inputCls} placeholder="Website" value={form.website} onChange={setF("website")} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <input className={`${inputCls} flex-1`} placeholder="Notes (used by the AI for personalization)" value={form.notes} onChange={setF("notes")} />
            <button
              className={btnPrimary}
              onClick={addContact}
              disabled={
                adding ||
                (!form.email && !(form.business_name && (form.instagram || form.phone)))
              }
            >
              {adding ? "Adding…" : "Add contact"}
            </button>
          </div>
        </Card>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-zinc-100">
          <input
            className={inputCls}
            placeholder="Search by email, business, category, Instagram, or LinkedIn…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-400 py-12 text-center">
            No contacts yet. Import a CSV with columns like{" "}
            <code className="bg-zinc-100 px-1 rounded">email</code>,{" "}
            <code className="bg-zinc-100 px-1 rounded">business_name</code>,{" "}
            <code className="bg-zinc-100 px-1 rounded">category</code>,{" "}
            <code className="bg-zinc-100 px-1 rounded">instagram</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-400 uppercase tracking-wide">
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Business</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Social</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium" title="Replied contacts stop receiving follow-ups">Replied</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2.5 font-medium">
                      <div>{c.email || "—"}</div>
                      {c.email && (
                        <div
                          className={`mt-0.5 text-[11px] font-normal ${
                            c.email_status === "valid"
                              ? "text-emerald-600"
                              : c.email_status === "invalid" || c.email_status === "risky"
                                ? "text-red-500"
                                : "text-zinc-400"
                          }`}
                        >
                          {c.email_status === "valid"
                            ? "domain verified"
                            : c.email_status === "invalid"
                              ? "invalid domain"
                              : c.email_status === "risky"
                                ? "risky address"
                                : "checked before sending"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{c.business_name || "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.category ? (
                        <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs">
                          {c.category}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {c.instagram && (
                          <a
                            href={`https://instagram.com/${c.instagram}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pink-600 hover:underline text-xs"
                          >
                            @{c.instagram}
                          </a>
                        )}
                        {c.linkedin && (
                          <a
                            href={`https://www.linkedin.com/${c.linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sky-700 hover:underline text-xs"
                          >
                            in/{c.linkedin.split("/")[1] ?? c.linkedin}
                          </a>
                        )}
                        {!c.instagram && !c.linkedin && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {c.unsubscribed ? (
                        <span className="text-xs text-red-500 font-medium">unsubscribed</span>
                      ) : c.bounced ? (
                        <span className="text-xs text-orange-500 font-medium" title="Email bounced — excluded from sending">bounced</span>
                      ) : (
                        <span className="text-xs text-emerald-600">subscribed</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <input
                        type="checkbox"
                        checked={Boolean(c.replied)}
                        onChange={() => toggleReplied(c)}
                        title="Mark as replied — stops follow-up emails to this contact"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => remove(c.id)}
                        className="text-xs text-zinc-400 hover:text-red-500"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
