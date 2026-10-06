import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminSessionUser } from "./admin-session";
import { SESSION_COOKIE_OPTIONS } from "./crypto";
export const ADMIN_COOKIE_OPTIONS = { ...SESSION_COOKIE_OPTIONS, sameSite: "strict" } as const;
export async function getAdminId(): Promise<number | null> {
  return adminSessionUser((await cookies()).get(ADMIN_COOKIE)?.value);
}
