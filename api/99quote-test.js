export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  try {
    const base = "https://polosj2-web.vercel.app/api/99envios";
    const payload = {
      action: "cotizar",
      payload: {
        destino: { nombre: "Bogotá", codigo: "11001000" },
        origen: { nombre: "Bogotá", codigo: "11001000" },
        idTipoEntrega: 1,
        idServicio: 1,
        valorDeclarado: 149900,
        peso: 1,
        alto: 10,
        largo: 10,
        ancho: 10,
        fecha: new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" }),
        seguro99: false,
        seguro99plus: false,
        AplicaContrapago: true
      }
    };
    const r = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    return res.status(r.status).json({ proxy_status: r.status, ...data });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || "Quote test failed" });
  }
}
