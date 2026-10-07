export default async function handler(req,res){
  try{
    const email=process.env.NINETY_NINE_ENVIOS_EMAIL,password=process.env.NINETY_NINE_ENVIOS_PASSWORD;
    const r=await fetch("https://api.99envios.app/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({email,password})});
    const t=await r.text(); let d={}; try{d=JSON.parse(t)}catch(_){}
    const safe={...d}; if(safe.token) safe.token="[redacted]"; if(safe.user) safe.user={...safe.user};
    return res.status(200).json({ok:r.ok,status:r.status,keys:Object.keys(d||{}),data:safe});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}