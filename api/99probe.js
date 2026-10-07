export default async function handler(req,res){
  if(req.method!=="GET"){return res.status(405).json({ok:false});}
  try{
    const u="https://99envios.app/static/js/main.1d94ea4f.js";
    const r=await fetch(u);
    const js=await r.text();
    const urls=[...js.matchAll(/https?:\/\/[^"'\\s)]+/g)].map(m=>m[0]);
    const api99=urls.filter(x=>x.includes("99envios"));
    const paths=[...js.matchAll(/["'`]([^"'`]{0,220}(?:sucursal|preenvio|pedido|envio|guia|ultima|masivo)[^"'`]{0,220})["'`]/gi)].map(m=>m[1]);
    return res.status(200).json({ok:r.ok,length:js.length,api99:[...new Set(api99)],paths:[...new Set(paths)].slice(0,1000)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}
