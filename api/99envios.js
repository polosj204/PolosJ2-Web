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

function normalizePayload(action, payload) {
  const p = { ...payload };

  // 99 Envíos validates this field strictly as d-m-Y. Generate it
  // server-side so browser formatting/caching cannot send dd-mm-yyyy.
  // Use Colombia time because the shipment date is a local business date.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "numeric",
    day: "numeric"
  }).formatToParts(new Date());
  const dateParts = {};
  for (const part of parts) {
    if (part.type !== "literal") dateParts[part.type] = part.value;
  }
  p.fecha = String(Number(dateParts.day)) + "-" + String(Number(dateParts.month)) + "-" + dateParts.year;

  return p;
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
  const rawText = await r.text();
  let data = {};
  try { data = rawText ? JSON.parse(rawText) : {}; } catch (_) { data = {}; }
  const responseHeaders = { contentType: r.headers.get("content-type") || "", location: r.headers.get("location") || "" };
  if (!r.ok) {
    if (r.status === 401) {
      cachedToken = null;
      cachedAt = 0;
    }
    const err = new Error(data.message || data.error || JSON.stringify(data));
    err.status = r.status || 502;
    err.data = data;
    err.raw = rawText;
    err.responseStatus = r.status;
    err.responseHeaders = responseHeaders;
    throw err;
  }
  return { status: r.status, data, raw: rawText, headers: responseHeaders };
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, configured: Boolean(process.env.NINETY_NINE_ENVIOS_EMAIL && process.env.NINETY_NINE_ENVIOS_PASSWORD) });
  }
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Método no permitido." });

  let safePayload = null;
  try {
    const { action, payload } = req.body || {};
    if (!["cotizar", "preenvio"].includes(action)) {
      return res.status(400).json({ ok: false, error: "Acción inválida. Usa cotizar o preenvio." });
    }
    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ ok: false, error: "Falta payload." });
    }
    safePayload = normalizePayload(action, payload);
    let result;
    try {
      result = await call99("/" + action, safePayload);
    } catch (firstError) {
      // 99 Envíos has returned inconsistent validation around fecha. For
      // cotización only (no shipment creation), retry once with the padded
      // equivalent if the first request is specifically rejected on fecha.
      const isDateValidation =
        action === "cotizar" &&
        firstError?.status === 422 &&
        /fecha/i.test(firstError?.raw || "") &&
        /format/i.test(firstError?.raw || "");
      if (!isDateValidation) throw firstError;

      const retryPayload = { ...safePayload };
      const m = String(safePayload.fecha || "").match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
      if (!m) throw firstError;
      retryPayload.fecha =
        String(m[1]).padStart(2, "0") + "-" +
        String(m[2]).padStart(2, "0") + "-" +
        m[3];
      safePayload = retryPayload;
      result = await call99("/" + action, retryPayload);
    }
    return res.status(200).json({ ok: true, data: result.data, upstream_status: result.status, upstream_raw: result.raw, upstream_headers: result.headers });
  } catch (e) {
    return res.status(e.status || 500).json({
      ok: false,
      error: e.message || "Error conectando con 99 Envíos.",
      details: e.data || null,
      upstream_status: e.responseStatus || null,
      upstream_raw: e.raw || "",
      upstream_headers: e.responseHeaders || null,
      normalized_fecha: safePayload?.fecha || null
    });
  }
}
