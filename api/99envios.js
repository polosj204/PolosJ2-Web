const API_BASE = "https://integration.99envios.app/api/integration/v1";
const HISTORY_BASE = "https://api.99envios.app/api/online";
const AVE_BASE = "https://api.aveonline.co/api-oficinas/public/api/v1/offices";
let officeCache = new Map();
const KNOWN_OFFICE_IDS={
  "05837000|CR18CONCL104":"7969",
  "05250000|AVJUVENTUD4833":"2291",
  "05250000|CR486409R":"17271"
};
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
function normOffice(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/CARRERA/g,"CR").replace(/CRA\.?/g,"CR").replace(/KR\.?/g,"CR").replace(/CALLE/g,"CL").replace(/CL\.?/g,"CL").replace(/[^A-Z0-9]/g,"");}
function officeAddressVariants(v){const raw=String(v||"");return [raw,raw.replace(/OFICINA INTERRAPID[IÍ]SIMO[^·]*·?/i,"")].map(normOffice).filter(Boolean);}
async function getAveOffices(dane){const r=await fetch(AVE_BASE+"/1016/"+encodeURIComponent(dane),{headers:{Accept:"application/json"}});const raw=await r.text();let d={};try{d=raw?JSON.parse(raw):{}}catch(_){}if(!r.ok)return [];const rows=Array.isArray(d?.data)?d.data:[];return rows.map(o=>({id:String(o.id||""),name:String(o.name||"Oficina Interrapidísimo"),address:String(o.location||""),city:String(o.city||"")})).filter(x=>x.address||x.name);}
async function getHistoricalOfficeMap(){const c=officeCache.get("__history__");if(c&&Date.now()-c.at<1800000)return c.map;const map=new Map();for(let page=1;page<=8;page++){const d=await callOnline("/envios_completos_v2/9002",{page,per_page:100,fecha_desde:"2025-01-01",fecha_hasta:"2026-10-07"});for(const row of Array.isArray(d.data)?d.data:[]){const addr=String(row.direccion_destinatario||"");const m=addr.toUpperCase().match(/\(OFC:\s*([0-9]+)\)/);if(!m)continue;for(const v of officeAddressVariants(addr))map.set(v,m[1]);}if(page>=Number(d.last_page||page))break;}officeCache.set("__history__",{at:Date.now(),map});return map;}
async function enrichOfficeIds(offices,dane=""){const hist=await getHistoricalOfficeMap();return offices.map(o=>{let id=o.id||"",source=o.source||"aveonline";for(const v of officeAddressVariants(o.address)){const known=KNOWN_OFFICE_IDS[String(dane)+"|"+v];if(known){id=known;source="99envios";break;}if(hist.has(v)){id=hist.get(v);source="99envios";break;}}return {...o,id,source};});}
async function getHistoricalOfficeOptions(cityName){
  const wanted=normOffice(cityName);
  const rows=[];
  for(let page=1;page<=8;page++){
    const d=await callOnline("/envios_completos_v2/9002",{page,per_page:100,fecha_desde:"2025-01-01",fecha_hasta:"2026-10-07"});
    if(Array.isArray(d.data)) rows.push(...d.data);
    if(page>=Number(d.last_page||page)) break;
  }
  const seen=new Map();
  for(const row of rows){
    const city=String(row.ciudad_destino||"").split(/[\\/,|]/)[0].trim();
    const addr=String(row.direccion_destinatario||"");
    const m=addr.toUpperCase().match(/\(OFC:\s*([0-9]+)\)/);
    if(!m || normOffice(city)!==wanted) continue;
    const address=addr.replace(/\s*\(OFC:\s*[0-9]+\)\s*/i,"").trim();
    const id=String(m[1]);
    const key=id+"|"+normOffice(address);
    if(!seen.has(key)) seen.set(key,{id,address,city,source:"99envios",name:"Oficina Interrapidísimo"});
  }
  return [...seen.values()];
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
      if(action==="prueba_oficina"){
        const token=await getToken();
        const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/Bogota",year:"numeric",month:"numeric",day:"numeric"}).formatToParts(new Date());
        const dp={}; for(const x of parts)if(x.type!=="literal")dp[x.type]=x.value;
        const payload={destino:{nombre:"Turbo",codigo:"05837000",IdCentroServicio:7969},origen:{nombre:"Bodega PolosJ2",codigo:"11001000"},IdTipoEntrega:2,IdServicio:2,valorDeclarado:149900,peso:1,alto:10,largo:10,ancho:10,fecha:String(dp.day).padStart(2,"0")+"-"+String(dp.month).padStart(2,"0")+"-"+dp.year,seguro99:false,seguro99plus:true,AplicaContrapago:true};
        const rr=await fetch(API_BASE+"/cotizar",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(payload)});
        const raw=await rr.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
        return res.status(rr.status).json({ok:rr.ok,upstream_status:rr.status,data,raw});
      }
      if(action==="probar_catalogos"){
        const token=await getToken();
        const paths=["/servicios","/tipos-servicio","/tipos-entrega","/tipo-entrega","/servicios-entrega","/configuracion","/catalogos"];
        const out={};
        for(const path of paths){
          try{
            const rr=await fetch(API_BASE+path,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
            const raw=await rr.text(); out[path]={status:rr.status,body:raw.slice(0,3000)};
          }catch(e){out[path]={error:e.message};}
        }
        return res.status(200).json({ok:true,out});
      }
      if(action==="muestra_oficina"){
        const rows=[];
        for(let page=1;page<=8;page++){
          const d=await callOnline("/envios_completos_v2/9002",{page,per_page:100,fecha_desde:"2025-01-01",fecha_hasta:"2026-10-07"});
          if(Array.isArray(d.data)) rows.push(...d.data);
          if(page>=Number(d.last_page||page)) break;
        }
        const officeRows=rows.filter(x=>/OFICINA INTERRAPID|\(OFC:/i.test(String(x.direccion_destinatario||"")));
        return res.status(200).json({ok:true,count:officeRows.length,samples:officeRows.slice(0,20).map(x=>{const out={};for(const [k,v] of Object.entries(x)){if(/tipo|servicio|centro|sucursal|transport|oficina|entrega/i.test(k))out[k]=v;}return out;})});
      }
      if(action==="prueba_preenvio_validacion"){
        const token=await getToken();
        const payload={IdTipoEntrega:2,IdServicio:3,AplicaContrapago:true,peso:1,largo:10,ancho:10,alto:10,diceContener:"PRUEBA",valorDeclarado:149900,seguro99:false,seguro99plus:true,
          Destinatario:{tipoDocumento:"ZZZ",numeroDocumento:"",nombre:"Juan",primerApellido:"NA",segundoApellido:"",telefono:"3000000000",direccion:"KR 18 CON CL 104",idLocalidad:"05837000",correo:""},
          transportadora:{pais:"colombia",nombre:"interrapidisimo"},origenCreacion:1};
        const rr=await fetch(API_BASE+"/preenvio",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(payload)});
        const raw=await rr.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
        return res.status(rr.status).json({ok:rr.ok,upstream_status:rr.status,data,raw});
      }
      if(action==="muestra_turbo"){
        const d=await callOnline("/envios_completos_v2/9002",{page:1,per_page:100,fecha_desde:"2025-01-01",fecha_hasta:"2026-10-07",ciudad_destino:"Turbo"});
        const rows=Array.isArray(d.data)?d.data:[];
        const samples=rows.filter(x=>/Turbo/i.test(String(x.ciudad_destino||""))&&/OFICINA INTERRAPID|\(OFC:/i.test(String(x.direccion_destinatario||""))).slice(0,20).map(x=>{const out={};for(const [k,v] of Object.entries(x)){if(/tipo|servicio|centro|sucursal|transport|oficina|entrega|guia|preenvio/i.test(k))out[k]=v;}return out;});
        return res.status(200).json({ok:true,total:rows.length,samples});
      }
      if(action==="historial") return res.status(200).json({ok:true,data:await getHistory()});
      if(action==="oficinas"){
        const dane=String(req.query?.dane||"").trim();
        if(!/^\d{8}$/.test(dane)) return res.status(400).json({ok:false,error:"DANE inválido."});
        const cached=officeCache.get(dane);
        if(cached && cached.source==="99envios" && Date.now()-cached.at<1800000) return res.status(200).json({ok:true,source:"99envios",offices:cached.offices});
        let offices=[];
        try{
          const token=await getToken();
          const candidates=[dane,dane.slice(0,5)].filter((v,i,a)=>/^\d{5,8}$/.test(v)&&a.indexOf(v)===i);
          for(const code of candidates){
            const rr=await fetch("https://integration.99envios.app/api/ver-efectividad-ciudades/"+code,{headers:{Authorization:"Bearer "+token,Accept:"application/json",Origin:"https://app.99envios.app",Referer:"https://app.99envios.app/"}});
            const raw=await rr.text();let data=[];try{data=raw?JSON.parse(raw):[]}catch(_){}
            if(rr.ok&&Array.isArray(data)){
              offices=data.map(x=>{const c=x?.CentroServicio||{};return{id:String(c.IdCentroServicio||""),address:String(c.Direccion||""),city:String(c.Ciudad||""),department:String(c.Departamento||""),source:"99envios"}}).filter(x=>x.id&&x.address);
              if(offices.length) break;
            }
          }
        }catch(_){}
        if(!offices.length){
          try{
            const cityName=String(req.query?.city||"").trim();
            if(cityName) offices=await getHistoricalOfficeOptions(cityName);
          }catch(_){}
        }
        if(!offices.length){
          try{ offices=await enrichOfficeIds(await getAveOffices(dane),dane); }catch(_){ offices=[]; }
        }
        const source=offices.some(x=>x.source==="99envios")?"99envios":offices.length?"aveonline":"99envios";
        officeCache.set(dane,{at:Date.now(),offices,source});
        return res.status(200).json({ok:true,source,offices});
      }
      if(action==="resolver_oficina"){
        const dane=String(req.query?.dane||"").trim(),address=String(req.query?.address||"").trim();
        if(!/^\d{8}$/.test(dane)||!address)return res.status(400).json({ok:false,error:"DANE y dirección de oficina son obligatorios."});
        let offices=officeCache.get(dane)?.offices||[];
        if(!offices.length) offices=await enrichOfficeIds(await getAveOffices(dane));
        const wanted=officeAddressVariants(address);
        const match=offices.find(o=>wanted.some(w=>officeAddressVariants(o.address).some(v=>w===v||w.includes(v)||v.includes(w))));
        if(!match||!match.id||String(match.id).startsWith("ave:"))return res.status(404).json({ok:false,error:"No pudimos confirmar el IdCentroServicio de esta oficina en 99 Envíos."});
        return res.status(200).json({ok:true,office:{...match,source:"99envios"}});
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
    p.fecha=String(dp.day).padStart(2,"0")+"-"+String(dp.month).padStart(2,"0")+"-"+dp.year;
    const token=await getToken();
    const r=await fetch(API_BASE+"/"+action,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(p)});
    const raw=await r.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(_){}
    if(!r.ok) return res.status(r.status||502).json({ok:false,error:data.message||data.error||raw,details:data,upstream_status:r.status});
    return res.status(200).json({ok:true,data,upstream_status:r.status,upstream_raw:raw});
  }catch(e){return res.status(e.status||502).json({ok:false,error:e.message});}
}