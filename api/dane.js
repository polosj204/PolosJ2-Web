const DANE_URL="https://www.datos.gov.co/resource/gdxc-w37w.json";

function norm(v){
  return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
}

let cache={at:0,rows:null};

async function getRows(){
  if(cache.rows && Date.now()-cache.at<3600000) return cache.rows;

  const qs=new URLSearchParams({
    "$limit":"5000",
    "$select":"cod_dpto,dpto,cod_mpio,nom_mpio,tipo_municipio",
  });

  const r=await fetch(DANE_URL+"?"+qs.toString(),{
    headers:{Accept:"application/json"}
  });
  const text=await r.text();
  let data={};
  try{ data=JSON.parse(text); }catch(_){}

  if(!r.ok || !Array.isArray(data)){
    throw new Error("No se pudo consultar la base DIVIPOLA.");
  }

  cache={at:Date.now(),rows:data};
  return data;
}

export default async function handler(req,res){
  if(req.method!=="GET"){
    res.setHeader("Allow","GET");
    return res.status(405).json({ok:false,error:"Método no permitido."});
  }

  const city=String(req.query?.city||"").trim();
  const department=String(req.query?.department||"").trim();

  if(!city){
    return res.status(400).json({ok:false,error:"Falta el municipio."});
  }

  try{
    const rows=await getRows();
    const cn=norm(city);
    const dn=norm(department);

    const matches=rows
      .filter(x=>norm(x.nom_mpio)===cn && (!dn||norm(x.dpto)===dn))
      .map(x=>({
        city:x.nom_mpio,
        department:x.dpto,
        dane:String(x.cod_mpio||"").padStart(5,"0")+"000"
      }));

    return res.status(200).json({ok:true,matches});
  }catch(e){
    return res.status(502).json({
      ok:false,
      error:e.message||"Error consultando DIVIPOLA."
    });
  }
}
