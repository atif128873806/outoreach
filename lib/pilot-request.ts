/** The public preview/analytics accept tiny JSON envelopes, never result payloads. */
export async function readPilotBody(request:Request):Promise<Record<string,unknown>|null>{
 if(Number(request.headers.get('content-length')??0)>512)return null;
 const reader=request.body?.getReader();if(!reader)return null;
 let size=0;const chunks:Uint8Array[]=[];
 try{
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;
   if(size>512){await reader.cancel();return null;}chunks.push(part.value);}
  const parsed:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:null;
 }catch{return null;}finally{reader.releaseLock();}
}
