const AVE_BASE = "https://api.aveonline.co/api-oficinas/public/api/v1/offices";

const cache = new Map();
const TTL = 30 * 60 * 1000;

function clean(v){
  return String(v ?? "").trim();
}

export default async function handler(req,res){
  if(req.method !== "GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"Método no permitido."});
  }

  const dane = clean(req.query?.dane);
  if(!/^\d{8}$/.test(dane)){
    return res.status(400).json({ok:false,error:"DANE inválido. Debe tener 8 dígitos."});
  }

  const key = "1016:"+dane;
  const hit = cache.get(key);
  if(hit && Date.now()-hit.at < TTL){
    return res.status(200).json({ok:true,source:"aveonline",carrier:"Interrapidísimo",carrierCode:"1016",dane,offices:hit.offices,cached:true});
  }

  try{
    const upstream = await fetch(AVE_BASE+"/1016/"+encodeURIComponent(dane),{
      headers:{Accept:"application/json"}
    });
    const text = await upstream.text();
    let data = {};
    try{ data = JSON.parse(text); }catch(_){}

    if(!upstream.ok){
      return res.status(upstream.status || 502).json({
        ok:false,
        source:"aveonline",
        upstream_status:upstream.status,
        error:data?.message || "Aveonline no pudo consultar las oficinas.",
        raw:text.slice(0,1000)
      });
    }

    const rows = Array.isArray(data?.data) ? data.data : [];
    const offices = rows.map((o,i)=>({
      id:clean(o.id) || String(i+1),
      name:clean(o.name) || "Oficina Interrapidísimo",
      address:clean(o.location),
      city:clean(o.city)
    })).filter(o=>o.address || o.name);

    cache.set(key,{at:Date.now(),offices});

    return res.status(200).json({
      ok:true,
      source:"aveonline",
      carrier:"Interrapidísimo",
      carrierCode:"1016",
      dane,
      offices,
      cached:false,
      upstream_status:upstream.status
    });
  }catch(e){
    return res.status(502).json({
      ok:false,
      source:"aveonline",
      error:e?.message || "No se pudo consultar Aveonline."
    });
  }
}
