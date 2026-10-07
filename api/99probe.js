export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/main.1d94ea4f.js");
    const js=await r.text();
    const pos=[]; const re=/(?:^|[;,])pe=/g;
    for(const m of js.matchAll(re)) pos.push(m.index);
    const contexts=pos.slice(0,20).map(p=>js.slice(Math.max(0,p-1000),Math.min(js.length,p+5000)));
    return res.status(200).json({ok:r.ok,count:pos.length,contexts});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}