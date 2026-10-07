export default async function handler(req,res){
  if(req.method!=="GET"){return res.status(405).json({ok:false});}
  try{
    const r=await fetch("https://99envios.app/dashboard99/masivo/null",{headers:{Accept:"text/html"}});
    const html=await r.text();
    const scripts=[...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m=>m[1]);
    return res.status(200).json({ok:r.ok,status:r.status,length:html.length,scripts,head:html.slice(0,5000)});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}
