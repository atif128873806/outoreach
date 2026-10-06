import { redirect } from "next/navigation";
import { getAdminId } from "@/lib/admin-auth";
import { q1 } from "@/lib/db";
import AdminFrame from "../AdminFrame";
export const dynamic="force-dynamic";
export default async function AdminLayout({children}:{children:React.ReactNode}){
  const id=await getAdminId();if(id==null)redirect("/admin/login");
  const user=await q1<{email:string}>("SELECT email FROM users WHERE id=$1",[id]);
  return <AdminFrame email={user?.email??"Administrator"}>{children}</AdminFrame>;
}
