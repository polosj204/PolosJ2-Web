export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/7258.8dd83ae0.chunk.js");
    const js=await r.text();
    const n="envios_completos_v2"; const p=js.indexOf(n);
    return res.status(200).json({ok:r.ok,context:p>=0?js.slice(Math.max(0,p-6000),Math.min(js.length,p+12000)):"not-found"});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}