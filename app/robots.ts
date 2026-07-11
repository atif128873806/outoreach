import type { MetadataRoute } from "next";

/** Index the marketing site; keep the app and API out of search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup"],
      disallow: [
        "/api/",
        "/dashboard",
        "/contacts",
        "/campaigns",
        "/messages",
        "/leads",
        "/settings",
        "/admin",
      ],
    },
  };
}
