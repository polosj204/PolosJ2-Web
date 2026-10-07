const API_BASE = "https://integration.99envios.app/api/integration/v1";
const HISTORY_BASE = "https://api.99envios.app/api/online";
const DANE_URL = "https://www.datos.gov.co/resource/gdxc-w37w.json";
const AVE_BASE = "https://api.aveonline.co/api-oficinas/public/api/v1/offices";

let tokenCache = { token:null, at:0 };
let daneCache = { rows:null, at:0 };

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
}

async function getToken(){
  if(tokenCache.token && Date.now()-tokenCache.at < 45*60*1000) return tokenCache.token;
  const email=process.env.NINETY_NINE_ENVIOS_EMAIL, password=process.env.NINETY_NINE_ENVIOS_PASSWORD;
  if(!email||!password) throw new Error("99 Envíos no está configurado.");
  const r=await fetch(API_BASE+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.token) throw new Error(d.message||d.error||"Login 99 Envíos rechazado.");
  tokenCache={token:d.token,at:Date.now()};
  return d.token;
}

async function getHistory(){
  const token=await getToken();
  const rows=[];
  for(let page=1;page<=8;page++){
    const u=new URL(HISTORY_BASE+"/envios_completos_v2/9002");
    u.searchParams.set("page",page);
    u.searchParams.set("per_page",100);
    u.searchParams.set("fecha_desde","2025-01-01");
    u.searchParams.set("fecha_hasta","2026-10-07");
    const r=await fetch(u,{headers:{Authorization:"Bearer "+token,Accept:"application/json"}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw new Error(d.message||d.error||"No se pudo consultar el historial.");
    if(Array.isArray(d.data)) rows.push(...d.data);
    if(page>=Number(d.last_page||page)) break;
  }
  return rows;
}

async function getDane(){
  if(daneCache.rows && Date.now()-daneCache.at<60*60*1000) return daneCache.rows;
  const u=new URL(DANE_URL);
  u.searchParams.set("$limit","5000");
  u.searchParams.set("$select","cod_dpto,dpto,cod_mpio,nom_mpio,tipo_municipio");
  const r=await fetch(u,{headers:{Accept:"application/json"}});
  const d=await r.json().catch(()=>[]);
  if(!r.ok||!Array.isArray(d)) throw new Error("No se pudo consultar DIVIPOLA.");
  daneCache={rows:d,at:Date.now()};
  return d;
}

async function getAve(dane){
  const r=await fetch(AVE_BASE+"/1016/"+encodeURIComponent(dane),{headers:{Accept:"application/json"}});
  const d=await r.json().catch(()=>({}));
  if(!r.ok) return {ok:false,offices:[]};
  const rows=Array.isArray(d?.data)?d.data:[];
  return {ok:true,offices:rows.map(o=>({id:String(o.id||""),name:String(o.name||"Interrapidísimo"),address:String(o.location||""),city:String(o.city||"")})).filter(o=>o.address||o.name)};
}

function extractOffice(row){
  const addr=String(row.direccion_destinatario||"");
  const m=addr.toUpperCase().match(/\\(OFC:\\s*([0-9]+)\\)/);
  return {
    id:m?.[1]||"",
    address:addr,
    isOffice:!!m || /OFICINA INTERRAPID/i.test(addr)
  };
}

async function mapLimit(items,limit,fn){
  const out=new Array(items.length);
  let next=0;
  async function worker(){
    while(true){
      const i=next++;
      if(i>=items.length) return;
      try{ out[i]=await fn(items[i],i); }catch(e){ out[i]={error:e.message||"Error"}; }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));
  return out;
}

export default async function handler(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"Método no permitido."});
  }

  try{
    const rows=await getHistory();
    const only=rows.map(r=>({row:r,office:extractOffice(r)})).filter(x=>x.office.isOffice);
    const byCity=new Map();

    for(const x of only){
      const city=String(x.row.ciudad_destino||"").split(/[\\/]/)[0].trim();
      if(!city) continue;
      const c=byCity.get(city)||{city,shipments:0,history_offices:new Map()};
      c.shipments++;
      const key=x.office.id||norm(x.office.address);
      const o=c.history_offices.get(key)||{office_id:x.office.id||"",shipments:0,addresses:[]};
      o.shipments++;
      if(o.addresses.length<5 && x.office.address && !o.addresses.includes(x.office.address)) o.addresses.push(x.office.address);
      c.history_offices.set(key,o);
      byCity.set(city,c);
    }

    const cities=[...byCity.values()].sort((a,b)=>b.shipments-a.shipments).slice(0,30);
    const dane=await getDane();

    const results=await mapLimit(cities,5,async c=>{
      const candidates=dane.filter(x=>norm(x.nom_mpio)===norm(c.city));
      const current=[];
      for(const d of candidates){
        const code=String(d.cod_mpio||"").padStart(5,"0")+"000";
        const av=await getAve(code);
        if(av.ok && av.offices.length) current.push({
          department:d.dpto,dane:code,offices:av.offices
        });
      }
      const hist=[...c.history_offices.values()].map(o=>({...o,active_matches:current.flatMap(g=>g.offices.filter(a=>o.addresses.some(h=>norm(h).includes(norm(a.address))||norm(a.address).includes(norm(h)))))}));
      return {city:c.city,office_shipments:c.shipments,history_offices:hist,current};
    });

    return res.status(200).json({ok:true,scope:"top_30_office_cities",results});
  }catch(e){
    return res.status(502).json({ok:false,error:e.message||"No se pudo cruzar historial y oficinas."});
  }
}
