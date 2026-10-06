const DANE_URL="https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query";

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}

async function queryDane(city, department=""){
  const where=department
    ? "UPPER(MPIO_CNMBRE) = '"+String(city).replace(/'/g,"''").toUpperCase()+"' AND UPPER(DPTO_CNMBRE) = '"+String(department).replace(/'/g,"''").toUpperCase()+"'"
    : "UPPER(MPIO_CNMBRE) = '"+String(city).replace(/'/g,"''").toUpperCase()+"'";
  const qs=new URLSearchParams({
    where,
    outFields:"DPTO_CCDGO,MPIO_CCDGO,MPIO_CDPMP,DPTO_CNMBRE,MPIO_CNMBRE",
    returnGeometry:"false",
    f:"json",
    resultRecordCount:"100"
  });
  const r=await fetch(DANE_URL+"?"+qs.toString());
  const d=await r.json().catch(()=>({}));
  if(!r.ok || d.error) throw new Error(d.error?.message||"No se pudo consultar DIVIPOLA.");
  return (d.features||[]).map(x=>x.attributes||{});
}

export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false,error:"Método no permitido."});}
  const city=String(req.query?.city||"").trim();
  const department=String(req.query?.department||"").trim();
  if(!city) return res.status(400).json({ok:false,error:"Falta el municipio."});
  try{
    const rows=await queryDane(city,department);
    const cn=norm(city), dn=norm(department);
    const matches=rows.filter(x=>norm(x.MPIO_CNMBRE)===cn && (!dn||norm(x.DPTO_CNMBRE)===dn));
    return res.status(200).json({
      ok:true,
      matches:matches.map(x=>({
        city:x.MPIO_CNMBRE,
        department:x.DPTO_CNMBRE,
        dane:(String(x.DPTO_CCDGO||"").padStart(2,"0")+String(x.MPIO_CCDGO||"").padStart(3,"0"))+"000"
      }))
    });
  }catch(e){
    return res.status(502).json({ok:false,error:e.message||"Error consultando DIVIPOLA."});
  }
}
