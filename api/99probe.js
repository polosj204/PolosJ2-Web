export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/runtime.39fb3e06.js");
    const js=await r.text();
    const p=js.indexOf("1523");
    return res.status(200).json({ok:r.ok,length:js.length,context:p>=0?js.slice(Math.max(0,p-1000),p+2000):"not-found"});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}