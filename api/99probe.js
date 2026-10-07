export default async function handler(req,res){
  try{
    const r=await fetch("https://99envios.app/static/js/main.1d94ea4f.js");
    const js=await r.text();
    const needles=["pe=async","pe=()=>","pe=({","function pe","pe:function","historico-envios"];
    const out={};
    for(const n of needles){
      const p=js.indexOf(n);
      out[n]=p>=0?js.slice(Math.max(0,p-4000),Math.min(js.length,p+10000)):"not-found";
    }
    return res.status(200).json({ok:r.ok,out});
  }catch(e){return res.status(502).json({ok:false,error:e.message});}
}