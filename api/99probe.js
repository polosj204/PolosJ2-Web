export default async function handler(req,res){
  const urls=[
    "https://api.99envios.app/api/online/sucursal/669785",
    "https://99envios.online/api/v1/historico-envios-completos?codigo_sucursal=669785&fecha_inicio=2026-01-01&fecha_fin=2026-10-07"
  ];
  const out=[];
  for(const u of urls){
    try{const r=await fetch(u,{headers:{Accept:"application/json"}});const t=await r.text();out.push({u,status:r.status,type:r.headers.get("content-type"),text:t.slice(0,5000)});}catch(e){out.push({u,error:e.message});}
  }
  return res.status(200).json(out);
}