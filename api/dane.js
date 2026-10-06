const DANE_URL="https://geoportal.dane.gov.co/mparcgis/rest/services/Divipola/Serv_DIVIPOLA_MGN_2025/FeatureServer/317/query";

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}

let cache={at:0,rows:null};

async function getRows(){
  if(cache.rows && Date.now()-cache.at<3600000) return cache.rows;
  const rows=[];
  const pageSize=2000;
  for(let offset=0;offset<10000;offset+=pageSize){
    const qs=new URLSearchParams({
      where:"1=1",
      outFields:"DPTO_CCDGO,MPIO_CCDGO,MPIO_CDPMP,DPTO_CNMBRE,MPIO_CNMBRE",
      returnGeometry:"false",
      f:"json",
      resultOffset:String(offset),
      resultRecordCount:String(pageSize)
    });
    const r=await fetch(DANE_URL+"?"+qs.toString());
    const d=await r.json().catch(()=>({}));
    if(!r.ok || d.error) throw new Error(d.error?.message||"No se pudo consultar DIVIPOLA.");
    const page=(d.features||[]).map(x=>x.attributes||{});
    rows.push(...page);
    if(!d.exceededTransferLimit || page.length<pageSize) break;
  }
  cache={at:Date.now(),rows};
  return rows;
}

export default async function handler(req,res){
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false,error:"Método no permitido."});}
  const city=String(req.query?.city||"").trim();
  const department=String(req.query?.department||"").trim();
  if(!city) return res.status(400).json({ok:false,error:"Falta el municipio."});
  try{
    const rows=await getRows();
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
