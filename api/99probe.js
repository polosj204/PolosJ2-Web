export default async function handler(req,res){
  if(req.method!=="GET"){return res.status(405).json({ok:false});}
  try{
    const r=await fetch("https://99envios.app/dashboard99/masivo/null",{headers:{Accept:"text/html"}});
    const html=await r.text();
    const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
    const base="https://99envios.app";
    const jsResults=[];
    for(const src of scripts){
      const u=src.startsWith("http")?src:base+src;
      const jr=await fetch(u);
      const js=await jr.text();
      const hits=[];
      const re=/(?:https?:\/\/[^"'\s]+)?(?:api\/|api\.|integration|sucursal|preenvio|ultima-milla|ultimaMilla|masivo)[^"'\s<>]*/gi;
      for(const m of js.matchAll(re)){
        const s=m[0];
        if(s.length<500) hits.push(s);
      }
      jsResults.push({src,length:js.length,hits:[...new Set(hits)].slice(0,500)});
    }
    return res.status(200).json({ok:true,status:r.status,scripts,jsResults});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}
