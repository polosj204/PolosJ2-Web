export default async function handler(req,res){
  const paths=[
    "/static/js/1523.b8f296e5.js",
    "/static/js/1523.b8f296e5.chunk.js",
    "/static/js/1523.js"
  ];
  const out=[];
  for(const p of paths){
    try{
      const r=await fetch("https://99envios.app"+p);
      const t=await r.text();
      out.push({p,status:r.status,type:r.headers.get("content-type"),length:t.length,head:t.slice(0,120)});
    }catch(e){out.push({p,error:e.message});}
  }
  return res.status(200).json(out);
}