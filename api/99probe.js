export default async function handler(req,res){
  try{
    const all=[];
    for(let page=1;page<=8;page++){
      const u=new URL("https://api.99envios.app/api/online/envios_completos_v2/9002");
      u.searchParams.set("page",String(page));u.searchParams.set("per_page","100");
      u.searchParams.set("fecha_desde","2025-01-01");u.searchParams.set("fecha_hasta","2026-10-07");
      const r=await fetch(u,{headers:{Accept:"application/json"}});
      if(!r.ok) throw new Error("Página "+page+" HTTP "+r.status);
      const d=await r.json(); all.push(...(d.data||[]));
      if(page>=Number(d.last_page||8)) break;
    }
    const cityMap=new Map(), officeMap=new Map(), carrierMap=new Map(), statusMap=new Map();
    for(const x of all){
      const city=String(x.ciudad_destino||"").split(/[\\/]/)[0].trim();
      const officeMatch=String(x.direccion_destinatario||"").match(/\\(OFC:\\s*(\\d+)\\)/i);
      const isOffice=!!officeMatch || /oficina interrapid/i.test(String(x.direccion_destinatario||""));
      const c=cityMap.get(city)||{shipments:0,office_shipments:0};
      c.shipments++; if(isOffice)c.office_shipments++; cityMap.set(city,c);
      const carrier=String(x.transportadora||"");
      carrierMap.set(carrier,(carrierMap.get(carrier)||0)+1);
      const status=String(x.estado_del_envio||"");
      statusMap.set(status,(statusMap.get(status)||0)+1);
      if(isOffice){
        const id=officeMatch?officeMatch[1]:"sin_id";
        const key=city+"|"+id;
        const o=officeMap.get(key)||{city,office_id:id,shipments:0,last_date:"",examples:[]};
        o.shipments++;
        const dt=String(x.fecha_envio||""); if(dt>o.last_date)o.last_date=dt;
        if(o.examples.length<3)o.examples.push({address:String(x.direccion_destinatario||"").slice(0,180),guide:String(x.numero_de_guia||"")});
        officeMap.set(key,o);
      }
    }
    const cities=[...cityMap.entries()].map(([city,v])=>({city,...v})).sort((a,b)=>b.shipments-a.shipments);
    const offices=[...officeMap.values()].sort((a,b)=>a.city.localeCompare(b.city)||Number(a.office_id)-Number(b.office_id));
    return res.status(200).json({
      ok:true,total:all.length,cities_count:cities.length,office_shipments:offices.reduce((n,o)=>n+o.shipments,0),
      cities,offices,carriers:Object.fromEntries(carrierMap),statuses:Object.fromEntries(statusMap)
    });
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}