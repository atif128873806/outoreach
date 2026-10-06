export function safeAdminNext(value: string | null): string {
  try {
    const target=new URL(value??"/admin","https://admin.invalid");
    if(target.origin!=="https://admin.invalid" || !["/admin","/admin/activity","/admin/errors","/admin/users","/admin/operations"].includes(target.pathname))return "/admin";
    return target.pathname+target.search;
  }catch{return "/admin";}
}

/** Configured public origin is authoritative behind a TLS proxy. Without it,
 * use the browser-facing Host and the proxy's protocol (never forwarded Host). */
export function validAdminOrigin(url: string, headers: Headers, configured = process.env.APP_URL): boolean {
  try {
    const expected = new URL(configured || url);
    if (!configured) {
      const host = headers.get("host") ?? expected.host;
      expected.port = "";
      expected.host = host;
      const protocol = headers.get("x-forwarded-proto");
      if (protocol === "https" || protocol === "http") expected.protocol = `${protocol}:`;
    }
    return headers.get("origin") === expected.origin;
  } catch { return false; }
}
