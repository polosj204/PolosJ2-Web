export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/1523.b8f296e5.js");
    const js=await r.text();
    const urls=[...js.matchAll(/https?:\/\/[^"'\\s)]+/g)].map(m=>m[0]);
    const paths=[...js.matchAll(/["'`]([^"'`]{0,300}(?:api|pedido|envio|guia|histor|sucursal|masivo|novedad)[^"'`]{0,300})["'`]/gi)].map(m=>m[1]);
    return res.status(200).json({ok:r.ok,status:r.status,length:js.length,urls:[...new Set(urls)],paths:[...new Set(paths)].slice(0,1000)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}