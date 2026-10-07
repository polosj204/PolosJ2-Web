const API_BASE = "https://integration.99envios.app/api/integration/v1";
const HISTORY_BASE = "https://api.99envios.app/api/online";
let cachedToken = null;
let cachedAt = 0;

function cors(res){
  res.setHeader("Access-Control-Allow-Origin","https://polosj2-web.vercel.app");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  return res;
}
async function getToken(){
  if(cachedToken && Date.now()-cachedAt<45*60*1000) return cachedToken;
  const email=process.env.NINETY_NINE_ENVIOS_EMAIL, password=process.env.NINETY_NINE_ENVIOS_PASSWORD;
  if(!email||!password) throw Object.assign(new Error("99 Envíos no está configurado."),{status:503});
  const r=await fetch(API_BASE+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.token) throw Object.assign(new Error(d.message||d.error||"Login rechazado"),{status:r.status||502});
  cachedToken=d.token; cachedAt=Date.now(); return cachedToken;
}
async function callOnline(path,query={}){
  const token=await getToken();
  const u=new URL(HISTORY_BASE+path);
  Object.entries(query).forEach(([k,v])=>u.searchParams.set(k,String(v)));
  const r=await fetch(u,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
  const raw=await r.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
  if(!r.ok) throw Object.assign(new Error(data.message||data.error||("HTTP "+r.status)),{status:r.status,data});
  return data;
}
function summarize(rows){
  const cities=new Map(), offices=new Map();
  for(const x of rows){
    const city=String(x.ciudad_destino||"").split(/[\\/]/)[0].trim();
    const addr=String(x.direccion_destinatario||"");
    const marker=addr.toUpperCase().indexOf("(OFC:");
    let officeId="";
    if(marker>=0){const m=addr.slice(marker+5).match(/[0-9]+/); if(m) officeId=m[0];}
    const isOffice=!!officeId||/OFICINA INTERRAPID/i.test(addr);
    const c=cities.get(city)||{shipments:0,office_shipments:0}; c.shipments++; if(isOffice)c.office_shipments++; cities.set(city,c);
    if(isOffice){
      const key=city+"|"+(officeId||"sin_id");
      const o=offices.get(key)||{city,office_id:officeId||"sin_id",shipments:0,addresses:[]};
      o.shipments++; if(o.addresses.length<3&&!o.addresses.includes(addr))o.addresses.push(addr.slice(0,200)); offices.set(key,o);
    }
  }
  return {total:rows.length,cities:[...cities.entries()].map(([city,v])=>({city,...v})).sort((a,b)=>b.shipments-a.shipments),offices:[...offices.values()].sort((a,b)=>a.city.localeCompare(b.city)||a.office_id.localeCompare(b.office_id))};
}
async function getHistory(){
  const rows=[];
  for(let page=1;page<=8;page++){
    const d=await callOnline("/envios_completos_v2/9002",{page,per_page:100,fecha_desde:"2025-01-01",fecha_hasta:"2026-10-07"});
    if(Array.isArray(d.data)) rows.push(...d.data);
    if(page>=Number(d.last_page||page)) break;
  }
  return summarize(rows);
}
export default async function handler(req,res){
  cors(res);
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method==="GET"){
    const action=String(req.query?.action||"");
    try{
      if(action==="historial") return res.status(200).json({ok:true,data:await getHistory()});
      if(action==="oficinas"){
        const dane=String(req.query?.dane||"").trim();
        if(!/^\d{8}$/.test(dane)) return res.status(400).json({ok:false,error:"DANE inválido."});

        // Fuente primaria: endpoint que 99 Envíos utiliza para consultar sus sucursales.
        try{
          const token=await getToken();
          const rr=await fetch("https://integration.99envios.app/api/ver-efectividad-ciudades/"+dane,{
            headers:{
              Authorization:"Bearer "+token,
              Accept:"application/json",
              Origin:"https://app.99envios.app",
              Referer:"https://app.99envios.app/"
            }
          });
          const raw=await rr.text(); let data=[]; try{data=raw?JSON.parse(raw):[]}catch(_){}
          if(rr.ok && Array.isArray(data)){
            const offices=data.map(x=>{
              const c=x?.CentroServicio||{};
              return {
                id:String(c.IdCentroServicio||""),
                address:String(c.Direccion||""),
                city:String(c.Ciudad||""),
                department:String(c.Departamento||""),
                source:"99envios"
              };
            }).filter(x=>x.id&&x.address);
            if(offices.length) return res.status(200).json({ok:true,source:"99envios",offices});
          }
        }catch(_){}

        // Respaldo: oficinas activas de Interrapidísimo. Su ID NO se trata como
        // IdCentroServicio de 99 Envíos; queda marcado para no generar guías incorrectas.
        try{
          const ave=await fetch("https://api.aveonline.co/api-oficinas/public/api/v1/offices/1016/"+encodeURIComponent(dane),{
            headers:{Accept:"application/json"}
          });
          const raw=await ave.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
          if(ave.ok){
            const rows=Array.isArray(data?.data)?data.data:[];
            const offices=rows.map((o,i)=>({
              id:"ave:"+dane+":"+String(o.id||i+1),
              address:String(o.location||""),
              city:String(o.city||""),
              department:"",
              name:String(o.name||"Interrapidísimo"),
              source:"aveonline"
            })).filter(x=>x.address||x.name);
            if(offices.length) return res.status(200).json({ok:true,source:"aveonline",offices});
          }
        }catch(_){}

        return res.status(200).json({ok:true,source:"none",offices:[]});
      }
      return res.status(200).json({ok:true,configured:true});
    }catch(e){return res.status(e.status||502).json({ok:false,error:e.message||"Error 99 Envíos."});}
  }
  if(req.method!=="POST") return res.status(405).json({ok:false,error:"Método no permitido."});
  try{
    const {action,payload}=req.body||{};
    if(!["cotizar","preenvio"].includes(action)||!payload) return res.status(400).json({ok:false,error:"Solicitud inválida."});
    const p={...payload};
    const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date());
    const dp={}; for(const x of parts)if(x.type!=="literal")dp[x.type]=x.value;
    p.fecha=String(Number(dp.day))+"-"+String(Number(dp.month))+"-"+dp.year;
    const token=await getToken();
    const r=await fetch(API_BASE+"/"+action,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(p)});
    const raw=await r.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
    if(!r.ok) return res.status(r.status||502).json({ok:false,error:data.message||data.error||raw,details:data,upstream_status:r.status});
    return res.status(200).json({ok:true,data,upstream_status:r.status,upstream_raw:raw});
  }catch(e){return res.status(e.status||502).json({ok:false,error:e.message});}
}