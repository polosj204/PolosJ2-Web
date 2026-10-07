export default async function handler(req,res){
  const files=[
    ["completos","7258.8dd83ae0.chunk.js"],
    ["masivo","8682.9feaead2.chunk.js"],
    ["buscar","9508.0d68591b.chunk.js"]
  ];
  const out=[];
  for(const [name,file] of files){
    try{
      const r=await fetch("https://99envios.app/static/js/"+file); const js=await r.text();
      const strings=[...js.matchAll(/["'`]([^"'`]{0,500})["'`]/g)].map(m=>m[1]);
      out.push({name,status:r.status,length:js.length,hits:[...new Set(strings.filter(s=>/api|pedido|envio|guia|histor|sucursal|masivo|estado/i.test(s)))].slice(0,800)});
    }catch(e){out.push({name,error:e.message});}
  }
  return res.status(200).json(out);
}