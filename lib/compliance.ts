/** Nodemailer options required for RFC 8058 one-click unsubscribe. */
export function oneClickUnsubscribeOptions(unsubUrl: string) {
  if (!unsubUrl) return {};
  return {
    list: { unsubscribe: { url: unsubUrl, comment: "Unsubscribe" } },
    headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}
