export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false });
  try {
    const base = "https://polosj2-web.vercel.app/api/99envios";
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value || "";
    const fecha = `${get("day")}-${get("month")}-${get("year")}`;

    const payload = {
      action: "cotizar",
      payload: {
        destino: { nombre: "Turbo", codigo: "05837000", IdCentroServicio: 7969 },
        origen: { nombre: "Bodega PolosJ2", codigo: "11001000" },
        IdTipoEntrega: 2,
        IdServicio: 2,
        valorDeclarado: 149900,
        peso: 1,
        alto: 10,
        largo: 10,
        ancho: 10,
        fecha,
        seguro99: false,\n        seguro99plus: true,
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
