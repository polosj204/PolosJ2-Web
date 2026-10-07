const AVE_BASE = "https://api.aveonline.co/api-oficinas/public/api/v1/offices";

const municipios = [
  ["El Bagre","Antioquia","05250000"],
  ["Caucasia","Antioquia","05154000"],
  ["Yarumal","Antioquia","05887000"],
  ["Puerto Berrío","Antioquia","05579000"],
  ["Apartadó","Antioquia","05045000"],
  ["Turbo","Antioquia","05837000"],
  ["San Gil","Santander","68679000"],
  ["Socorro","Santander","68755000"],
  ["Villanueva","Casanare","85440000"],
  ["Aguazul","Casanare","85010000"],
  ["Acacías","Meta","50006000"],
  ["Granada","Meta","50313000"],
  ["Garzón","Huila","41298000"],
  ["Espinal","Tolima","73268000"],
  ["Lorica","Córdoba","23417000"],
  ["Sahagún","Córdoba","23660000"],
  ["Medellín","Antioquia","05001000"]
];

async function one([city,department,dane]){
  try{
    const r=await fetch(AVE_BASE+"/1016/"+dane,{headers:{Accept:"application/json"}});
    const text=await r.text();
    let data={}; try{data=JSON.parse(text)}catch(_){}
    const rows=Array.isArray(data?.data)?data.data:[];
    const offices=rows.map((o,i)=>({
      id:String(o.id??i+1),
      name:String(o.name??""),
      address:String(o.location??""),
      city:String(o.city??"")
    })).filter(o=>o.address||o.name);
    return {city,department,dane,status:r.status,ok:r.ok,count:offices.length,offices};
  }catch(e){
    return {city,department,dane,status:0,ok:false,count:0,offices:[],error:e?.message||"error"};
  }
}

export default async function handler(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"Método no permitido."});
  }
  const results=[];
  for(const item of municipios) results.push(await one(item));
  return res.status(200).json({
    ok:true,
    source:"Aveonline",
    carrier:"Interrapidísimo",
    carrierCode:"1016",
    tested:results.length,
    results
  });
}
