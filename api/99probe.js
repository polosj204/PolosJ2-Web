export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/1523.b8f296e5.chunk.js");
    const js=await r.text();
    const n="https://99envios.online/api/v1/historico-envios-completos";
    const p=js.indexOf(n);
    return res.status(200).json({ok:r.ok,context:p>=0?js.slice(Math.max(0,p-3500),Math.min(js.length,p+4500)):"not-found"});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}