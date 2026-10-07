export default async function handler(req,res){
  try{
    const u=new URL("https://api.99envios.app/api/online/envios_completos_v2/9002");
    u.searchParams.set("page","1");u.searchParams.set("per_page","100");
    u.searchParams.set("fecha_desde","2025-01-01");u.searchParams.set("fecha_hasta","2026-10-07");
    const r=await fetch(u,{headers:{Accept:"application/json"}});
    const t=await r.text();let d;try{d=JSON.parse(t)}catch(_){d=t.slice(0,3000)}
    return res.status(200).json({ok:r.ok,status:r.status,type:r.headers.get("content-type"),data:d});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}