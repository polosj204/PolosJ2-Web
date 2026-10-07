export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/1523.b8f296e5.chunk.js");
    const js=await r.text();
    const urls=[...js.matchAll(/https?:\/\/[^"'\\s)]+/g)].map(m=>m[0]);
    const strings=[...js.matchAll(/["'`]([^"'`]{0,500})["'`]/g)].map(m=>m[1]);
    const hits=strings.filter(s=>/api|pedido|envio|guia|histor|sucursal|masivo|fecha|estado/i.test(s));
    return res.status(200).json({ok:r.ok,length:js.length,urls:[...new Set(urls)],hits:[...new Set(hits)].slice(0,1000)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}