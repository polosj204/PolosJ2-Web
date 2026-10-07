export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/448.f0843ff2.chunk.js");
    const js=await r.text();
    const hits=[]; for(const n of ["codigoSucursal","usuario_id","sucursal","login","api/online"]){let p=0,c=0;while((p=js.indexOf(n,p))>=0&&c<10){hits.push({n,context:js.slice(Math.max(0,p-1800),Math.min(js.length,p+3000))});p+=n.length;c++;}}
    return res.status(200).json({ok:r.ok,status:r.status,length:js.length,hits});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}