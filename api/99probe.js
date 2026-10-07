export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/main.1d94ea4f.js");
    const js=await r.text();
    const n="historico-envios";
    const p=js.indexOf(n);
    return res.status(200).json({ok:r.ok,context:p>=0?js.slice(Math.max(0,p-2500),Math.min(js.length,p+5000)):"not-found"});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}