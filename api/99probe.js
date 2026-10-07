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
    const cityMap=new Map(), officeMap=new Map();
    for(const x of all){
      const city=String(x.ciudad_destino||"").split(/[\\/]/)[0].trim();
      const addr=String(x.direccion_destinatario||"");
      const marker=addr.toUpperCase().indexOf("(OFC:");
      let officeId="";
      if(marker>=0){
        const tail=addr.slice(marker+5);
        const digits=tail.match(/[0-9]+/);
        officeId=digits?digits[0]:"";
      }
      const isOffice=!!officeId || /OFICINA INTERRAPID/i.test(addr);
      const c=cityMap.get(city)||{shipments:0,office_shipments:0};
      c.shipments++; if(isOffice)c.office_shipments++; cityMap.set(city,c);
      if(isOffice){
        const id=officeId||"sin_id";
        const key=city+"|"+id;
        const o=officeMap.get(key)||{city,office_id:id,shipments:0,last_date:"",addresses:[]};
        o.shipments++;
        const dt=String(x.fecha_envio||""); if(dt>o.last_date)o.last_date=dt;
        if(o.addresses.length<2&&!o.addresses.includes(addr))o.addresses.push(addr.slice(0,180));
        officeMap.set(key,o);
      }
    }
    const cities=[...cityMap.entries()].map(([city,v])=>({city,...v})).sort((a,b)=>b.shipments-a.shipments);
    const offices=[...officeMap.values()].sort((a,b)=>a.city.localeCompare(b.city)||String(a.office_id).localeCompare(String(b.office_id)));
    return res.status(200).json({ok:true,total:all.length,cities_count:cities.length,office_shipments:offices.reduce((n,o)=>n+o.shipments,0),cities,offices});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}