export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/main.1d94ea4f.js");
    const js=await r.text();
    const p=js.lastIndexOf("sourceMappingURL");
    return res.status(200).json({ok:r.ok,tail:js.slice(Math.max(0,js.length-1000)),source:p>=0?js.slice(p-100,p+300):"none"});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}