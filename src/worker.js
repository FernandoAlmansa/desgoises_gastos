/**
 * Worker de Cloudflare: sirve la app (carpeta public/) y su API sobre una base D1.
 *
 * Variables (Cloudflare → Workers → gastos-desgoises → Settings → Variables and Secrets):
 *   APP_KEY        (Secret)  clave para entrar a la app. Si no está, se usa DASH_KEY (la clave anterior).
 *   NOTION_TOKEN   (Secret)  opcional, solo para importar los gastos viejos de Notion.
 *   NOTION_DATABASE_ID (Text) opcional, idem.
 */
import { MIGRATIONS, SCHEMA_VERSION } from "./schema.js";

const COOKIE = "dg_sesion";
const TZ = "America/Argentina/Buenos_Aires";

// Columnas que la app puede escribir en cada tabla.
const TABLES = {
  opciones: ["tipo", "nombre", "orden", "archivada"],
  colecciones: ["nombre", "foto_id", "archivada"],
  productos: ["nombre", "coleccion_id", "foto_id", "archivado"],
  tandas: ["producto_id", "nombre", "coleccion_id", "cant_estimada", "cant_final", "estado", "cerrada"],
  muestras: ["nombre", "producto_id", "archivada", "foto_id", "no_produce"],
  campanas: ["nombre", "coleccion_id", "archivada"],
  gastos: [
    "fecha", "monto", "moneda", "categoria", "muestra_id", "producto_id", "tanda_id", "campana_id",
    "opcion_id", "concepto", "descripcion", "medio_pago", "proveedor", "comprobante_id", "cantidad",
    "cubre_meses", "estimado", "en_cantidad", "kg", "coleccion_id", "estampa", "envio", "publi_tipo",
  ],
  pagos: ["gasto_id", "fecha", "monto", "medio_pago"],
  producto_packaging: ["producto_id", "gasto_id", "por_prenda"],
  simulaciones: ["producto_id", "tanda_id", "numero", "unidades", "descripcion", "cambios"],
};
const REQUIRED = {
  opciones: ["tipo", "nombre"], colecciones: ["nombre"], productos: ["nombre"], tandas: ["producto_id", "nombre"],
  muestras: ["nombre"], campanas: ["nombre"], gastos: ["fecha", "monto"], pagos: ["gasto_id", "fecha", "monto"],
  producto_packaging: ["producto_id", "gasto_id"], simulaciones: ["producto_id", "unidades"],
};
// Qué tablas no se pueden borrar si un gasto las usa.
const REFERENCED_BY_GASTOS = {
  muestras: "muestra_id", productos: "producto_id", tandas: "tanda_id", campanas: "campana_id", opciones: "opcion_id",
  colecciones: "coleccion_id",
};

let schemaReady = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      await ensureSchema(env.DB);
      return await api(request, env, url);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Error del servidor: " + (err.message || err) }, 500);
    }
  },
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

async function ensureSchema(db) {
  if (schemaReady) return;
  let version = 0;
  try {
    const row = await db.prepare("SELECT valor FROM ajustes WHERE clave = 'schema'").first();
    version = row ? Number(row.valor) : 0;
  } catch { /* tabla todavía no existe */ }
  for (let v = version + 1; v <= SCHEMA_VERSION; v++) {
    const stmts = MIGRATIONS[v].map((sql) => db.prepare(sql));
    stmts.push(db.prepare("INSERT INTO ajustes (clave, valor) VALUES ('schema', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").bind(String(v)));
    await db.batch(stmts);
  }
  schemaReady = true;
}

/* ---------------- Rutas ---------------- */

async function api(request, env, url) {
  const path = url.pathname.replace(/^\/api\//, "").replace(/\/$/, "");
  const parts = path.split("/");
  const method = request.method;

  if (path === "login" && method === "POST") return login(request, env);
  if (path === "logout" && method === "POST") return json({ ok: true }, 200, { "Set-Cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });

  await requireAuth(request, env);
  const db = env.DB;

  if (path === "data" && method === "GET") return json(await allData(db));
  if (path === "importar-notion" && method === "POST") return json(await importNotion(env));

  if (parts[0] === "archivos") {
    if (method === "POST" && parts.length === 1) return uploadFile(request, db);
    if (method === "GET" && parts.length === 2) return getFile(db, parts[1], url.searchParams.has("thumb"));
  }
  if (parts[0] === "campanas" && parts[2] === "tandas" && method === "PUT") {
    return json(await setCampaignTandas(db, int(parts[1]), await request.json()));
  }
  if (parts[0] === "gastos" && parts[2] === "tandas" && method === "PUT") {
    return json(await setGastoTandas(db, int(parts[1]), await request.json()));
  }
  if (parts[0] === "campanas" && parts[2] === "prendas" && method === "PUT") {
    return json(await setCampanaPrendas(db, int(parts[1]), await request.json()));
  }
  if (parts[0] === "gastos" && parts[2] === "vinculos" && method === "PUT") {
    return json(await setGastoVinculos(db, int(parts[1]), await request.json()));
  }
  if (path === "tanda_conceptos" && method === "PUT") {
    const b = await request.json();
    if (b.estado) {
      await db.prepare("INSERT INTO tanda_conceptos (tanda_id, concepto, estado) VALUES (?, ?, ?) ON CONFLICT(tanda_id, concepto) DO UPDATE SET estado = excluded.estado")
        .bind(int(b.tanda_id), String(b.concepto), String(b.estado)).run();
    } else {
      await db.prepare("DELETE FROM tanda_conceptos WHERE tanda_id = ? AND concepto = ?").bind(int(b.tanda_id), String(b.concepto)).run();
    }
    return json({ ok: true });
  }
  if (path === "ajustes" && method === "PUT") {
    const b = await request.json();
    if (!/^[a-z_]+$/.test(b.clave || "") || b.clave === "schema") throw new HttpError(400, "Ajuste inválido");
    await db.prepare("INSERT INTO ajustes (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor")
      .bind(b.clave, JSON.stringify(b.valor)).run();
    return json({ ok: true });
  }

  const table = parts[0];
  if (!TABLES[table]) throw new HttpError(404, "Ruta desconocida");
  const id = parts[1] ? int(parts[1]) : null;
  if (method === "POST" && !id) return json(await insertRow(db, table, await request.json()), 201);
  if (method === "PATCH" && id) return json(await updateRow(db, table, id, await request.json()));
  if (method === "DELETE" && id) return json(await deleteRow(db, table, id));
  throw new HttpError(405, "Método no permitido");
}

/* ---------------- Sesión ---------------- */

function appKey(env) {
  const k = env.APP_KEY || env.DASH_KEY;
  if (!k) throw new HttpError(500, "Falta configurar la clave (APP_KEY) en Cloudflare");
  return k;
}
async function sessionToken(env) {
  const data = new TextEncoder().encode("desgoises:" + appKey(env));
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function login(request, env) {
  const { clave } = await request.json().catch(() => ({}));
  if (!clave || clave !== appKey(env)) throw new HttpError(401, "La clave no es correcta");
  const token = await sessionToken(env);
  const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
  return json({ ok: true }, 200, {
    "Set-Cookie": `${COOKIE}=${token}; Path=/; Max-Age=31536000; HttpOnly;${secure} SameSite=Lax`,
  });
}
async function requireAuth(request, env) {
  const cookies = Object.fromEntries((request.headers.get("Cookie") || "").split(/;\s*/).filter(Boolean).map((c) => {
    const i = c.indexOf("=");
    return [c.slice(0, i), c.slice(i + 1)];
  }));
  if (cookies[COOKIE] !== (await sessionToken(env))) throw new HttpError(401, "Sesión vencida");
}

/* ---------------- Datos ---------------- */

async function allData(db) {
  const q = (sql) => db.prepare(sql).all().then((r) => r.results);
  const [opciones, colecciones, productos, tandas, tandaConceptos, muestras, campanas, campanaTandas, gastos, pagos, ajustes, historial,
    gastoTandas, productoPackaging, gastoVinculos, campanaPrendas, simulaciones] =
    await Promise.all([
      q("SELECT * FROM opciones ORDER BY tipo, orden, nombre"),
      q("SELECT * FROM colecciones ORDER BY creado DESC"),
      q("SELECT * FROM productos ORDER BY nombre"),
      q("SELECT * FROM tandas ORDER BY producto_id, id"),
      q("SELECT * FROM tanda_conceptos"),
      q("SELECT * FROM muestras ORDER BY creado DESC"),
      q("SELECT * FROM campanas ORDER BY creado DESC"),
      q("SELECT * FROM campana_tandas"),
      q("SELECT * FROM gastos ORDER BY fecha DESC, id DESC"),
      q("SELECT * FROM pagos ORDER BY fecha, id"),
      q("SELECT * FROM ajustes WHERE clave != 'schema'"),
      q("SELECT * FROM historial ORDER BY id DESC LIMIT 500"),
      q("SELECT * FROM gasto_tandas"),
      q("SELECT * FROM producto_packaging ORDER BY id"),
      q("SELECT * FROM gasto_vinculos"),
      q("SELECT * FROM campana_prendas ORDER BY id"),
      q("SELECT * FROM simulaciones ORDER BY producto_id, numero, id"),
    ]);
  return {
    opciones, colecciones, productos, tandas, tandaConceptos, muestras, campanas, campanaTandas, gastos, pagos, historial,
    gastoTandas, productoPackaging, gastoVinculos, campanaPrendas, simulaciones,
    ajustes: Object.fromEntries(ajustes.map((a) => [a.clave, safeParse(a.valor)])),
  };
}

function clean(table, body, partial) {
  const out = {};
  for (const col of TABLES[table]) {
    if (!(col in body)) continue;
    let v = body[col];
    if (v === "" || v === undefined) v = null;
    if (v !== null && (col.endsWith("_id") || ["monto", "cantidad", "cubre_meses", "cant_estimada", "cant_final", "orden", "numero", "unidades"].includes(col))) {
      v = Math.round(Number(v));
      if (!Number.isFinite(v)) throw new HttpError(400, `Valor inválido en ${col}`);
    }
    if (v !== null && col === "kg") {
      v = Math.round(Number(v) * 1000) / 1000;
      if (!Number.isFinite(v) || v < 0) throw new HttpError(400, "Kilos inválidos");
    }
    if (v !== null && col === "por_prenda") {
      v = Math.round(Number(v) * 100) / 100;
      if (!Number.isFinite(v) || v <= 0) throw new HttpError(400, "La cantidad por prenda tiene que ser mayor a cero");
    }
    if (v !== null && col === "envio" && !["correo", "expreso", "flete", "cadete"].includes(v)) throw new HttpError(400, "Tipo de envío inválido");
    if (v !== null && col === "publi_tipo" && !["conversion", "visibilidad"].includes(v)) throw new HttpError(400, "Tipo de publicidad inválido");
    if (v !== null && col === "unidades" && !(v > 0)) throw new HttpError(400, "Las unidades tienen que ser más que cero");
    if (v !== null && col === "cambios") {
      if (typeof v !== "string") v = JSON.stringify(v);
      if (v.length > 20000) throw new HttpError(400, "La simulación tiene demasiados cambios");
      try { JSON.parse(v); } catch { throw new HttpError(400, "Cambios inválidos"); }
      out[col] = v;
      continue;
    }
    if (v !== null && col === "estampa" && !["bordado", "serigrafia", "serigrafia_propia", "dtf"].includes(v)) throw new HttpError(400, "Tipo de estampa inválido");
    if (["estimado", "en_cantidad", "cerrada", "archivada", "archivado", "no_produce"].includes(col)) v = v ? 1 : 0;
    if (typeof v === "string") v = v.trim().slice(0, 500);
    out[col] = v;
  }
  if (!partial) for (const col of REQUIRED[table]) if (out[col] == null) throw new HttpError(400, `Falta ${col}`);
  if (table === "gastos" && "monto" in out && !(out.monto > 0)) throw new HttpError(400, "El importe tiene que ser mayor a cero");
  if (table === "pagos" && "monto" in out && !(out.monto > 0)) throw new HttpError(400, "El pago tiene que ser mayor a cero");
  return out;
}

async function insertRow(db, table, body) {
  const row = clean(table, body, false);
  const cols = Object.keys(row);
  const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING *`;
  const stmts = [db.prepare(sql).bind(...cols.map((c) => row[c]))];

  // Un gasto puede venir con su primer pago (pagado total o seña).
  if (table === "gastos" && body.pago_inicial && Number(body.pago_inicial.monto) > 0) {
    const p = body.pago_inicial;
    stmts.push(db.prepare("INSERT INTO pagos (gasto_id, fecha, monto, medio_pago) VALUES (last_insert_rowid(), ?, ?, ?)")
      .bind(p.fecha || row.fecha, Math.round(Number(p.monto)), p.medio_pago || row.medio_pago || null));
  }
  // Todo producto nace con su primera tanda, así la carga nunca pregunta de más.
  if (table === "productos") {
    stmts.push(db.prepare("INSERT INTO tandas (producto_id, nombre, coleccion_id) VALUES (last_insert_rowid(), 'Primera producción', ?)")
      .bind(row.coleccion_id ?? null));
  }
  const [res] = await db.batch(stmts);
  return res.results[0];
}

async function updateRow(db, table, id, body) {
  const row = clean(table, body, true);
  const cols = Object.keys(row);
  if (!cols.length) throw new HttpError(400, "Nada para actualizar");
  const before = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!before) throw new HttpError(404, "No existe");
  const extra = table === "gastos" ? ", actualizado = datetime('now')" : "";
  const sql = `UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(", ")}${extra} WHERE id = ? RETURNING *`;
  const after = await db.prepare(sql).bind(...cols.map((c) => row[c]), id).first();

  // Historial de cambios para poder explicar por qué cambió un costo.
  if (table === "gastos" || table === "tandas") {
    const changes = {};
    for (const c of cols) if (before[c] !== after[c]) changes[c] = [before[c], after[c]];
    if (Object.keys(changes).length) {
      const tandaId = table === "tandas" ? id : after.tanda_id ?? before.tanda_id;
      await db.prepare("INSERT INTO historial (entidad, entidad_id, tanda_id, detalle) VALUES (?, ?, ?, ?)")
        .bind(table, id, tandaId ?? null, JSON.stringify(changes)).run();
    }
  }
  return after;
}

async function deleteRow(db, table, id) {
  const ref = REFERENCED_BY_GASTOS[table];
  if (ref) {
    const used = await db.prepare(`SELECT COUNT(*) AS n FROM gastos WHERE ${ref} = ?`).bind(id).first();
    if (used.n > 0) throw new HttpError(409, `Tiene ${used.n} gasto${used.n === 1 ? "" : "s"} asociado${used.n === 1 ? "" : "s"}. Archivalo en lugar de borrarlo.`);
  }
  const stmts = [];
  if (table === "gastos") {
    const g = await db.prepare("SELECT * FROM gastos WHERE id = ?").bind(id).first();
    if (g) stmts.push(db.prepare("INSERT INTO historial (entidad, entidad_id, tanda_id, detalle) VALUES ('gastos', ?, ?, ?)")
      .bind(id, g.tanda_id, JSON.stringify({ borrado: [g.descripcion || g.concepto || g.categoria, g.monto] })));
    stmts.push(db.prepare("DELETE FROM pagos WHERE gasto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM gasto_tandas WHERE gasto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM producto_packaging WHERE gasto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM gasto_vinculos WHERE gasto_id = ? OR ref_id = ?").bind(id, id));
  }
  if (table === "tandas") {
    stmts.push(db.prepare("DELETE FROM campana_tandas WHERE tanda_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM tanda_conceptos WHERE tanda_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM gasto_tandas WHERE tanda_id = ?").bind(id));
    stmts.push(db.prepare("UPDATE campana_prendas SET tanda_id = NULL WHERE tanda_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM simulaciones WHERE tanda_id = ?").bind(id));
  }
  if (table === "campanas") {
    stmts.push(db.prepare("DELETE FROM campana_tandas WHERE campana_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM campana_prendas WHERE campana_id = ?").bind(id));
  }
  if (table === "productos") {
    const t = await db.prepare("SELECT COUNT(*) AS n FROM gastos WHERE tanda_id IN (SELECT id FROM tandas WHERE producto_id = ?)").bind(id).first();
    if (t.n > 0) throw new HttpError(409, "Tiene gastos asociados. Archivalo en lugar de borrarlo.");
    stmts.push(db.prepare("DELETE FROM campana_tandas WHERE tanda_id IN (SELECT id FROM tandas WHERE producto_id = ?)").bind(id));
    stmts.push(db.prepare("DELETE FROM gasto_tandas WHERE tanda_id IN (SELECT id FROM tandas WHERE producto_id = ?)").bind(id));
    stmts.push(db.prepare("DELETE FROM producto_packaging WHERE producto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM campana_prendas WHERE producto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM simulaciones WHERE producto_id = ?").bind(id));
    stmts.push(db.prepare("DELETE FROM tandas WHERE producto_id = ?").bind(id));
    stmts.push(db.prepare("UPDATE muestras SET producto_id = NULL WHERE producto_id = ?").bind(id));
  }
  if (table === "colecciones") {
    for (const t of ["productos", "tandas", "campanas"]) stmts.push(db.prepare(`UPDATE ${t} SET coleccion_id = NULL WHERE coleccion_id = ?`).bind(id));
  }
  stmts.push(db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id));
  await db.batch(stmts);
  return { ok: true };
}

async function setCampaignTandas(db, campanaId, body) {
  const ids = [...new Set((body.tanda_ids || []).map(int))];
  const stmts = [db.prepare("DELETE FROM campana_tandas WHERE campana_id = ?").bind(campanaId)];
  for (const t of ids) stmts.push(db.prepare("INSERT INTO campana_tandas (campana_id, tanda_id) VALUES (?, ?)").bind(campanaId, t));
  await db.batch(stmts);
  return { ok: true };
}

// Tandas de un gasto con sus datos: ventas (publicidad de conversión) y avíos por prenda.
// Acepta { tandas: [{ tanda_id, ventas, por_prenda }] } o, como antes, { tanda_ids: [...] }.
async function setGastoTandas(db, gastoId, body) {
  const filas = new Map();
  for (const x of body.tandas || (body.tanda_ids || []).map((tanda_id) => ({ tanda_id }))) {
    const ventas = x.ventas == null || x.ventas === "" ? null : Math.round(Number(x.ventas));
    const pp = x.por_prenda == null || x.por_prenda === "" ? null : Math.round(Number(x.por_prenda) * 100) / 100;
    if (ventas != null && !(ventas >= 0)) throw new HttpError(400, "Ventas inválidas");
    if (pp != null && !(pp > 0)) throw new HttpError(400, "Los avíos por prenda tienen que ser más que cero");
    filas.set(int(x.tanda_id), [ventas, pp]);
  }
  const stmts = [db.prepare("DELETE FROM gasto_tandas WHERE gasto_id = ?").bind(gastoId)];
  for (const [t, [ventas, pp]] of filas) {
    stmts.push(db.prepare("INSERT INTO gasto_tandas (gasto_id, tanda_id, ventas, por_prenda) VALUES (?, ?, ?, ?)").bind(gastoId, t, ventas, pp));
  }
  await db.batch(stmts);
  return { ok: true };
}

// Prendas entregadas como parte de pago en una campaña: reemplaza la lista completa (producto, tanda, cantidad).
async function setCampanaPrendas(db, campanaId, body) {
  const stmts = [db.prepare("DELETE FROM campana_prendas WHERE campana_id = ?").bind(campanaId)];
  for (const x of body.prendas || []) {
    const cant = Math.round(Number(x.cantidad));
    if (!(cant > 0)) continue;
    stmts.push(db.prepare("INSERT INTO campana_prendas (campana_id, producto_id, tanda_id, cantidad) VALUES (?, ?, ?, ?)")
      .bind(campanaId, int(x.producto_id), x.tanda_id == null ? null : int(x.tanda_id), cant));
  }
  await db.batch(stmts);
  return { ok: true };
}

// Compras (telas o moldes) a las que corresponde un envío.
async function setGastoVinculos(db, gastoId, body) {
  const ids = [...new Set((body.ref_ids || []).map(int))].filter((r) => r !== gastoId);
  const stmts = [db.prepare("DELETE FROM gasto_vinculos WHERE gasto_id = ?").bind(gastoId)];
  for (const r of ids) stmts.push(db.prepare("INSERT INTO gasto_vinculos (gasto_id, ref_id) VALUES (?, ?)").bind(gastoId, r));
  await db.batch(stmts);
  return { ok: true };
}

/* ---------------- Archivos (fotos y comprobantes) ---------------- */

const MAX_FILE = 1_800_000; // D1 admite filas de hasta 2 MB
async function uploadFile(request, db) {
  const form = await request.formData();
  const file = form.get("file");
  const thumb = form.get("thumb");
  if (!file || typeof file === "string") throw new HttpError(400, "Falta el archivo");
  if (file.size > MAX_FILE) throw new HttpError(413, "El archivo es muy pesado (máximo 1,8 MB)");
  const type = file.type || "application/octet-stream";
  if (!/^image\/|^application\/pdf$/.test(type)) throw new HttpError(415, "Solo fotos o PDF");
  const data = new Uint8Array(await file.arrayBuffer());
  const th = thumb && typeof thumb !== "string" ? new Uint8Array(await thumb.arrayBuffer()) : null;
  const row = await db.prepare("INSERT INTO archivos (tipo, data, thumb) VALUES (?, ?, ?) RETURNING id").bind(type, data, th).first();
  return json({ id: row.id, tipo: type }, 201);
}

async function getFile(db, id, wantThumb) {
  const row = await db.prepare("SELECT tipo, data, thumb FROM archivos WHERE id = ?").bind(int(id)).first();
  if (!row) throw new HttpError(404, "No existe");
  const useThumb = wantThumb && row.thumb;
  const bytes = new Uint8Array(useThumb ? row.thumb : row.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": useThumb ? "image/jpeg" : row.tipo,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

/* ---------------- Importación desde Notion (una sola vez) ---------------- */

const NOTION_CATS = [
  [/^muestra/i, "muestras"], [/^producc/i, "produccion"], [/^molder/i, "molderia"], [/contenido|campa/i, "campanas"],
  [/^publicidad/i, "publicidad"], [/^suscrip/i, "suscripciones"], [/^env[ií]o|posventa/i, "posventa"], [/^equipa/i, "equipamiento"],
  [/^comisi/i, "comisiones"], [/^administ/i, "administracion"], [/^packag/i, "packaging"],
];

async function importNotion(env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) throw new HttpError(400, "Faltan NOTION_TOKEN y NOTION_DATABASE_ID en Cloudflare");
  const notion = async (path, init = {}) => {
    const res = await fetch("https://api.notion.com/v1" + path, {
      ...init,
      headers: { Authorization: `Bearer ${env.NOTION_TOKEN}`, "Notion-Version": "2025-09-03", "Content-Type": "application/json" },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpError(502, `Notion ${res.status}: ${body.message || "sin detalle"}`);
    return body;
  };
  let ds = env.NOTION_DATA_SOURCE_ID;
  if (!ds) {
    const dbInfo = await notion(`/databases/${env.NOTION_DATABASE_ID}`);
    ds = dbInfo.data_sources?.[0]?.id;
    if (!ds) throw new HttpError(502, "La base de Notion no tiene fuentes de datos visibles");
  }
  const rows = [];
  let cursor = null;
  do {
    const body = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await notion(`/data_sources/${ds}/query`, { method: "POST", body: JSON.stringify(body) });
    for (const page of res.results) {
      const p = page.properties || {};
      const title = Object.values(p).find((x) => x?.type === "title");
      const monto = p["Monto"]?.number;
      if (typeof monto !== "number" || monto <= 0) continue;
      const catName = p["Categoria"]?.select?.name || "";
      rows.push({
        notion_id: page.id,
        descripcion: (title?.title || []).map((t) => t.plain_text).join("").trim() || null,
        monto: Math.round(monto * 100),
        categoria: NOTION_CATS.find(([re]) => re.test(catName))?.[1] ?? null,
        medio_pago: p["Medio de pago"]?.select?.name || null,
        fecha: (p["Fecha"]?.date?.start || "").slice(0, 10) || new Date(page.created_time).toLocaleDateString("sv-SE", { timeZone: TZ }),
      });
    }
    cursor = res.has_more ? res.next_cursor : null;
  } while (cursor && rows.length < 20000);

  const db = env.DB;
  let nuevos = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const stmts = [];
    for (const r of rows.slice(i, i + 40)) {
      stmts.push(db.prepare(`INSERT INTO gastos (fecha, monto, categoria, descripcion, medio_pago, notion_id)
        VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(notion_id) DO NOTHING`)
        .bind(r.fecha, r.monto, r.categoria, r.descripcion, r.medio_pago, r.notion_id));
      stmts.push(db.prepare(`INSERT INTO pagos (gasto_id, fecha, monto, medio_pago)
        SELECT id, fecha, monto, medio_pago FROM gastos WHERE notion_id = ? AND NOT EXISTS (SELECT 1 FROM pagos WHERE gasto_id = gastos.id)`)
        .bind(r.notion_id));
    }
    const res = await db.batch(stmts);
    for (let j = 0; j < res.length; j += 2) nuevos += res[j].meta.changes || 0;
  }
  // Medios de pago que no existían quedan disponibles para futuras cargas.
  const medios = [...new Set(rows.map((r) => r.medio_pago).filter(Boolean))];
  if (medios.length) {
    await db.batch(medios.map((m) => db.prepare(`INSERT INTO opciones (tipo, nombre, orden) SELECT 'medio_pago', ?, 99
      WHERE NOT EXISTS (SELECT 1 FROM opciones WHERE tipo = 'medio_pago' AND lower(nombre) = lower(?))`).bind(m, m)));
  }
  return { leidos: rows.length, nuevos };
}

/* ---------------- Utilidades ---------------- */

function int(v) {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new HttpError(400, "Id inválido");
  return n;
}
function safeParse(s) { try { return JSON.parse(s); } catch { return s; } }
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers },
  });
}
