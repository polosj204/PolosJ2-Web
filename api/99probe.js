export default async function handler(req,res){
  try{
    const url=new URL("https://99envios.online/api/v1/historico-envios-completos");
    url.searchParams.set("codigo_sucursal","669785");
    url.searchParams.set("fecha_inicio","2025-10-01");
    url.searchParams.set("fecha_fin","2026-10-07");
    const r=await fetch(url,{headers:{Accept:"application/json"}});
    const text=await r.text();
    let data; try{data=JSON.parse(text)}catch(_){data=text.slice(0,2000)}
    return res.status(200).json({ok:r.ok,status:r.status,type:r.headers.get("content-type"),data});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}