import type { MetadataRoute } from "next";

const BASE = "https://outreach.sakodev.com";

/**
 * Sitemap for the public marketing site. Generated from code so new pages
 * only need a line here — never a stale hand-edited XML file.
 * Priorities reflect commercial value; Google treats them as hints.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
    { path: "/", priority: 1.0, changeFrequency: "weekly" },
    { path: "/features", priority: 0.9, changeFrequency: "weekly" },
    { path: "/pricing", priority: 0.9, changeFrequency: "weekly" },
    { path: "/demo", priority: 0.8, changeFrequency: "monthly" },
    { path: "/guides", priority: 0.8, changeFrequency: "weekly" },
    { path: "/guides/cold-email-deliverability", priority: 0.8, changeFrequency: "monthly" },
    { path: "/guides/find-local-business-emails", priority: 0.8, changeFrequency: "monthly" },
    { path: "/tools/spam-checker", priority: 0.8, changeFrequency: "monthly" },
    { path: "/tools/dns-checker", priority: 0.8, changeFrequency: "monthly" },
    { path: "/docs", priority: 0.7, changeFrequency: "weekly" },
    { path: "/signup", priority: 0.6, changeFrequency: "monthly" },
    { path: "/contact", priority: 0.4, changeFrequency: "monthly" },
    { path: "/terms", priority: 0.2, changeFrequency: "monthly" },
    { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
    { path: "/refund-policy", priority: 0.2, changeFrequency: "monthly" },
  ];

  const lastModified = new Date();
  return pages.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified,
    changeFrequency: p.changeFrequency,
    priority: p.priority,
  }));
}
