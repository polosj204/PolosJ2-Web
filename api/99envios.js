const API_BASE = "https://integration.99envios.app/api/integration/v1";
let cachedToken = null;
let cachedAt = 0;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://polosj2-web.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res;
}

async function getToken() {
  if (cachedToken && Date.now() - cachedAt < 45 * 60 * 1000) return cachedToken;
  const email = process.env.NINETY_NINE_ENVIOS_EMAIL;
  const password = process.env.NINETY_NINE_ENVIOS_PASSWORD;
  if (!email || !password) {
    const err = new Error("99 Envíos aún no está configurado en Vercel. Faltan NINETY_NINE_ENVIOS_EMAIL y NINETY_NINE_ENVIOS_PASSWORD.");
    err.status = 503;
    throw err;
  }
  const r = await fetch(API_BASE + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.token) {
    const err = new Error(data.message || data.error || "99 Envíos rechazó el inicio de sesión.");
    err.status = r.status || 502;
    throw err;
  }
  cachedToken = data.token;
  cachedAt = Date.now();
  return cachedToken;
}

async function call99(path, body) {
  const token = await getToken();
  const r = await fetch(API_BASE + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401) {
      cachedToken = null;
      cachedAt = 0;
    }
    const err = new Error(data.message || data.error || JSON.stringify(data));
    err.status = r.status || 502;
    err.data = data;
    throw err;
  }
  return data;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") return res.status(200).json({ ok: true, configured: Boolean(process.env.NINETY_NINE_ENVIOS_EMAIL && process.env.NINETY_NINE_ENVIOS_PASSWORD) });
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido." });

  try {
    const { action, payload } = req.body || {};
    if (!["cotizar", "preenvio"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Acción inválida. Usa cotizar o preenvio." });
    }
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Falta payload." });
    }
    const data = await call99("/" + action, payload);
    return res.status(200).json({ ok: true, data });
  } catch (e) {
    return res.status(e.status || 500).json({
      ok: false,
      error: e.message || "Error conectando con 99 Envíos.",
      details: e.data || null
    });
  }
}
