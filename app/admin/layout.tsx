import type { Metadata } from "next";
import { SITE } from "@/lib/site";
export const metadata:Metadata={title:{default:"Administration",template:`%s · ${SITE.name} Admin`},robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return children;}
