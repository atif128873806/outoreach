"use client";
import { Suspense,type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { pilotAudience,pilotSignupPath } from '@/lib/pilot';
type Props={children:ReactNode;className?:string;onClick?:()=>void};
function IntentLink({children,className,onClick}:Props){
 const params=useSearchParams();
 return <Link href={pilotSignupPath(pilotAudience(params.get('audience')))} className={className} onClick={onClick}>{children}</Link>;
}
export default function PilotSignupLink(props:Props){
 return <Suspense fallback={<Link href="/signup" className={props.className} onClick={props.onClick}>{props.children}</Link>}><IntentLink {...props}/></Suspense>;
}
