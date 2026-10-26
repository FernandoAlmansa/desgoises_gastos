// Reglas de cálculo. No toca la pantalla: recibe los datos y devuelve números verificables.
// Los importes están en centavos y se agrupan por moneda ({ ARS: 123, USD: 4 }); nunca se suman monedas distintas.

export const CATEGORIAS = [
  { key: "muestras", nombre: "Muestras", destino: "muestra", conceptos: "concepto_muestra", icon: "scissors" },
  { key: "produccion", nombre: "Producción de ropa", destino: "producto", tanda: true, conceptos: "concepto_prod", icon: "shirt" },
  { key: "molderia", nombre: "Moldería", destino: "producto", icon: "ruler" },
  { key: "campanas", nombre: "Campañas de contenido de colecciones", corto: "Campañas de contenido", destino: "campana", conceptos: "concepto_campana", icon: "camera" },
  { key: "publicidad", nombre: "Publicidad", destino: "producto", tanda: true, coleccion: true, icon: "megaphone" },
  { key: "suscripciones", nombre: "Suscripciones y fijos", destino: "opcion", opcionTipo: "suscripcion", general: true, icon: "repeat" },
  { key: "envios", nombre: "Envíos y posventa", general: true, icon: "truck" },
  { key: "equipamiento", nombre: "Equipamiento", general: true, icon: "wrench" },
  { key: "comisiones", nombre: "Comisiones y cobros", general: true, icon: "percent" },
  { key: "administracion", nombre: "Administración e impuestos", general: true, icon: "landmark" },
  { key: "packaging", nombre: "Packaging y presentación", destino: "opcion", opcionTipo: "packaging", general: true, icon: "package" },
];
export const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.key, c]));

/* ---------- Dinero por moneda ---------- */

export const M = {
  zero: () => ({}),
  of: (moneda, cents) => (cents ? { [moneda || "ARS"]: cents } : {}),
  add(a, b) { const o = { ...a }; for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; },
  sum(list) { return list.reduce((acc, m) => M.add(acc, m), {}); },
  scale(a, f) { const o = {}; for (const k in a) o[k] = a[k] * f; return o; },
  isZero(a) { return !Object.values(a).some((v) => Math.abs(v) >= 0.5); },
  get: (a, k = "ARS") => a[k] || 0,
};

/* ---------- Índices ---------- */

export function index(D) {
  const by = (arr) => new Map(arr.map((x) => [x.id, x]));
  const group = (arr, key) => {
    const m = new Map();
    for (const x of arr) { const k = x[key]; if (k == null) continue; if (!m.has(k)) m.set(k, []); m.get(k).push(x); }
    return m;
  };
  const I = {
    D,
    gasto: by(D.gastos), producto: by(D.productos), tanda: by(D.tandas), muestra: by(D.muestras),
    campana: by(D.campanas), coleccion: by(D.colecciones), opcion: by(D.opciones),
    pagosDe: group(D.pagos, "gasto_id"),
    gastosDeTanda: group(D.gastos, "tanda_id"),
    gastosDeProducto: group(D.gastos, "producto_id"),
    gastosDeMuestra: group(D.gastos, "muestra_id"),
    gastosDeCampana: group(D.gastos, "campana_id"),
    gastosDeOpcion: group(D.gastos, "opcion_id"),
    gastosDeColeccion: group(D.gastos, "coleccion_id"),
    tandasDeProducto: group(D.tandas, "producto_id"),
    muestrasDeProducto: group(D.muestras, "producto_id"),
    noAplica: new Set(D.tandaConceptos.filter((c) => c.estado === "no_aplica").map((c) => `${c.tanda_id}|${c.concepto}`)),
    tandasDeCampana: new Map(), campanasDeTanda: new Map(),
    tandasDeGasto: new Map(), gastosDeTandaMulti: new Map(),
    packagingDeProducto: group(D.productoPackaging || [], "producto_id"),
  };
  for (const ct of D.campanaTandas) {
    if (!I.tandasDeCampana.has(ct.campana_id)) I.tandasDeCampana.set(ct.campana_id, []);
    I.tandasDeCampana.get(ct.campana_id).push(ct.tanda_id);
    if (!I.campanasDeTanda.has(ct.tanda_id)) I.campanasDeTanda.set(ct.tanda_id, []);
    I.campanasDeTanda.get(ct.tanda_id).push(ct.campana_id);
  }
  // Publicidad cargada a varios productos: el gasto queda sin tanda propia y se reparte entre las suyas.
  for (const gt of D.gastoTandas || []) {
    if (!I.tandasDeGasto.has(gt.gasto_id)) I.tandasDeGasto.set(gt.gasto_id, []);
    I.tandasDeGasto.get(gt.gasto_id).push(gt.tanda_id);
    if (!I.gastosDeTandaMulti.has(gt.tanda_id)) I.gastosDeTandaMulti.set(gt.tanda_id, []);
    I.gastosDeTandaMulti.get(gt.tanda_id).push(gt.gasto_id);
  }
  for (const id of I.tandasDeGasto.keys()) { const g = I.gasto.get(id); if (g) g._multi = true; }
  I.campaignCache = new Map();
  I.publiColCache = new Map();
  I.publiMultiCache = new Map();
  return I;
}

/* ---------- Pagos ---------- */

export function pagoInfo(I, g) {
  const pagado = (I.pagosDe.get(g.id) || []).reduce((s, p) => s + p.monto, 0);
  const pendiente = Math.max(0, g.monto - pagado);
  const estado = pendiente <= 0 ? "pagado" : pagado > 0 ? "parcial" : "pendiente";
  return { acordado: g.monto, pagado, pendiente, estado };
}

/* ---------- Tandas y unidades ---------- */

export function unidades(t) {
  if (t.cant_final != null) return { n: t.cant_final, estimada: false };
  if (t.cant_estimada != null) return { n: t.cant_estimada, estimada: true };
  return { n: null, estimada: false };
}

export const tandaColeccionId = (I, t) => t.coleccion_id ?? I.producto.get(t.producto_id)?.coleccion_id ?? null;

// El desarrollo (muestras vinculadas y moldería) se carga una sola vez, en la primera tanda del producto.
export function primeraTanda(I, productoId) {
  const ts = I.tandasDeProducto.get(productoId) || [];
  return ts.reduce((min, t) => (!min || t.id < min.id ? t : min), null);
}

export function gastosDesarrollo(I, productoId) {
  const molde = (I.gastosDeProducto.get(productoId) || []).filter((g) => g.categoria === "molderia");
  const muestras = (I.muestrasDeProducto.get(productoId) || []).flatMap((m) => (I.gastosDeMuestra.get(m.id) || []).filter((g) => g.categoria === "muestras"));
  return [...muestras, ...molde];
}

/* ---------- Reparto de campañas ---------- */

// Reparte cada moneda por separado con el método del mayor resto, así las partes suman exactamente el total.
export function splitByUnits(totalCents, units) {
  const U = units.reduce((s, u) => s + u, 0);
  if (!U) return units.map(() => 0);
  const raw = units.map((u) => (totalCents * u) / U);
  const out = raw.map(Math.floor);
  let rest = totalCents - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) out[order[k][1]]++;
  return out;
}

export function campaignInfo(I, campanaId) {
  if (I.campaignCache.has(campanaId)) return I.campaignCache.get(campanaId);
  const gastos = I.gastosDeCampana.get(campanaId) || [];
  const total = M.sum(gastos.filter((g) => g.categoria === "campanas").map((g) => M.of(g.moneda, g.monto)));
  const tandas = (I.tandasDeCampana.get(campanaId) || []).map((id) => I.tanda.get(id));
  const info = { id: campanaId, ...repartir(total, tandas, gastos) };
  I.campaignCache.set(campanaId, info);
  return info;
}

// Publicidad cargada a una colección entera: se reparte entre las unidades de todas sus tandas.
export function publiColeccionInfo(I, coleccionId) {
  if (I.publiColCache.has(coleccionId)) return I.publiColCache.get(coleccionId);
  const gastos = (I.gastosDeColeccion.get(coleccionId) || []).filter((g) => g.categoria === "publicidad" && !g.tanda_id);
  const total = M.sum(gastos.map((g) => M.of(g.moneda, g.monto)));
  const tandas = I.D.tandas.filter((t) => tandaColeccionId(I, t) === coleccionId);
  const info = { id: coleccionId, ...repartir(total, tandas, gastos) };
  I.publiColCache.set(coleccionId, info);
  return info;
}

// Publicidad cargada a varios productos elegidos: se reparte entre las unidades de esas tandas.
export function publiMultiInfo(I, gastoId) {
  if (I.publiMultiCache.has(gastoId)) return I.publiMultiCache.get(gastoId);
  const g = I.gasto.get(gastoId);
  const tandas = (I.tandasDeGasto.get(gastoId) || []).map((id) => I.tanda.get(id));
  const info = { id: gastoId, gasto: g, ...repartir(M.of(g.moneda, g.monto), tandas, [g]) };
  I.publiMultiCache.set(gastoId, info);
  return info;
}

// Packaging vinculado al producto: precio por unidad de la compra × cuántos lleva cada prenda × unidades.
export function packagingInfo(I, productoId, n) {
  return (I.packagingDeProducto.get(productoId) || []).map((link) => {
    const g = I.gasto.get(link.gasto_id);
    const unit = g?.cantidad ? g.monto / g.cantidad : null;
    const monto = unit != null && n ? M.of(g.moneda, Math.round(unit * link.por_prenda * n)) : null;
    return { link, gasto: g, opcion: g ? I.opcion.get(g.opcion_id) : null, unit, monto };
  }).filter((x) => x.gasto);
}

// Reparte un total entre tandas según sus unidades (finales o, si no hay, estimadas).
function repartir(total, tandas, gastos) {
  const parts = tandas.filter(Boolean).map((t) => ({ tanda: t, ...unidades(t) }));
  const faltan = parts.filter((p) => p.n == null);
  let estado;
  if (!parts.length) estado = "sin_productos";
  else if (faltan.length) estado = "falta_cantidad";
  else if (parts.some((p) => p.estimada) || gastos.some((g) => g.estimado)) estado = "estimado";
  else estado = "final";

  const asignado = new Map();
  const totalUnidades = parts.reduce((s, p) => s + (p.n || 0), 0);
  if (estado === "estimado" || estado === "final") {
    for (const p of parts) asignado.set(p.tanda.id, {});
    for (const moneda in total) {
      const split = splitByUnits(total[moneda], parts.map((p) => p.n));
      parts.forEach((p, i) => { if (split[i]) asignado.get(p.tanda.id)[moneda] = split[i]; });
    }
  }
  return { gastos, total, parts, totalUnidades, estado, asignado, faltan };
}

/* ---------- Costos de una tanda ---------- */

export function tandaCosts(I, tandaId) {
  const t = I.tanda.get(tandaId);
  const u = unidades(t);
  const propios = I.gastosDeTanda.get(tandaId) || [];
  const prod = propios.filter((g) => g.categoria === "produccion");
  const publi = propios.filter((g) => g.categoria === "publicidad");
  const esPrimera = primeraTanda(I, t.producto_id)?.id === t.id;
  const desa = esPrimera ? gastosDesarrollo(I, t.producto_id) : [];

  const campanas = (I.campanasDeTanda.get(tandaId) || []).map((cid) => {
    const c = campaignInfo(I, cid);
    return { campana: I.campana.get(cid), info: c, monto: c.asignado.get(tandaId) || null };
  });

  const colId = tandaColeccionId(I, t);
  const pc = colId != null ? publiColeccionInfo(I, colId) : null;
  const publiCol = pc && !M.isZero(pc.total) ? { coleccion: I.coleccion.get(colId), info: pc, monto: pc.asignado.get(tandaId) || null } : null;

  const publiMulti = (I.gastosDeTandaMulti.get(tandaId) || []).map((gid) => {
    const info = publiMultiInfo(I, gid);
    return { gasto: info.gasto, info, monto: info.asignado.get(tandaId) || null };
  });
  const pack = packagingInfo(I, t.producto_id, u.n);

  const tot = (gs) => M.sum(gs.map((g) => M.of(g.moneda, g.monto)));
  const lineas = {
    produccion: { total: tot(prod), gastos: prod },
    desarrollo: { total: tot(desa), gastos: desa, aplica: esPrimera },
    packaging: { total: M.sum(pack.map((x) => x.monto || {})), items: pack },
    campana: { total: M.sum(campanas.map((c) => c.monto || {})), campanas },
    publicidad: {
      total: M.sum([tot(publi), publiCol?.monto || {}, ...publiMulti.map((x) => x.monto || {})]),
      gastos: publi, coleccion: publiCol, multi: publiMulti,
    },
  };
  const fabricacion = M.sum([lineas.produccion.total, lineas.desarrollo.total, lineas.packaging.total]);
  const directo = M.sum([fabricacion, lineas.campana.total, lineas.publicidad.total]);

  // Conceptos de producción que todavía no tienen gasto ni están marcados "no aplica".
  const conceptos = I.D.opciones.filter((o) => o.tipo === "concepto_prod" && !o.archivada).map((o) => o.nombre);
  const cargados = new Set(prod.map((g) => g.concepto).filter(Boolean));
  const conceptosPendientes = conceptos.filter((c) => !cargados.has(c) && !I.noAplica.has(`${tandaId}|${c}`));

  const avisos = [];
  if (u.n == null) avisos.push("Falta cargar cantidad para calcular el costo unitario");
  for (const c of campanas) {
    if (c.info.estado === "falta_cantidad") avisos.push(`Reparto de ${c.campana.nombre} pendiente: falta cantidad en ${c.info.faltan.length} producto${c.info.faltan.length > 1 ? "s" : ""}`);
  }
  if (publiCol?.info.estado === "falta_cantidad" && u.n != null) {
    const n = publiCol.info.faltan.length;
    avisos.push(`Reparto de la publicidad de ${publiCol.coleccion?.nombre} pendiente: falta cantidad en ${n} producto${n > 1 ? "s" : ""}`);
  }
  for (const x of publiMulti) {
    if (x.info.estado === "falta_cantidad" && u.n != null) avisos.push(`Reparto de la publicidad “${x.gasto.descripcion || "sin descripción"}” pendiente: falta cantidad en otro producto`);
  }
  for (const x of pack) {
    if (x.unit == null) avisos.push(`Packaging ${x.opcion?.nombre || ""}: la compra no tiene la cantidad de unidades`);
  }
  const hayEstimados = u.estimada || [...prod, ...desa, ...publi].some((g) => g.estimado) || campanas.some((c) => c.info.estado === "estimado") ||
    publiCol?.info.estado === "estimado" || publiMulti.some((x) => x.info.estado === "estimado");

  let estado;
  if (t.cerrada) estado = "cerrado";
  else if (u.n == null || campanas.some((c) => c.info.estado === "falta_cantidad") || publiCol?.info.estado === "falta_cantidad" ||
    publiMulti.some((x) => x.info.estado === "falta_cantidad")) estado = "incompleto";
  else if (hayEstimados) estado = "estimado";
  else estado = "al_dia";

  return {
    tanda: t, unidades: u, esPrimera, lineas, fabricacion, directo, estado, avisos, conceptosPendientes,
    tela: telaInfo(prod, u.n),
    porUnidad: (m) => (u.n ? M.scale(m, 1 / u.n) : null),
  };
}

/* ---------- Rendimiento de tela ---------- */

export const esTela = (concepto) => /^tela/i.test(concepto || "");

// Kilos de tela comprados para una tanda contra las unidades que salieron.
// Cada tela (por descripción) se mide por separado y también todas juntas.
export function telaInfo(gastos, n) {
  const telas = gastos.filter((g) => esTela(g.concepto));
  const conKg = telas.filter((g) => g.kg > 0);
  const medir = (gs) => {
    const kg = gs.reduce((s, g) => s + g.kg, 0);
    const total = M.sum(gs.map((g) => M.of(g.moneda, g.monto)));
    return {
      kg, total, gastos: gs,
      porKg: kg ? M.scale(total, 1 / kg) : null, // costo de la tela por kilo
      unidadesPorKg: kg && n ? n / kg : null,    // prendas que salen de cada kilo
      kgPorUnidad: kg && n ? kg / n : null,      // consumo de tela por prenda
    };
  };
  const grupos = new Map();
  for (const g of conKg) {
    const nombre = (g.descripcion || g.proveedor || "Tela").trim();
    const k = nombre.toLowerCase();
    if (!grupos.has(k)) grupos.set(k, { nombre, gastos: [] });
    grupos.get(k).gastos.push(g);
  }
  return {
    ...medir(conKg),
    telas: [...grupos.values()].map((x) => ({ nombre: x.nombre, ...medir(x.gastos) })),
    sinKg: telas.length - conKg.length,
    hayTela: telas.length > 0,
  };
}

/* ---------- Producto (resumen para tarjeta) ---------- */

export function productoResumen(I, productoId) {
  const ts = (I.tandasDeProducto.get(productoId) || []).slice().sort((a, b) => a.id - b.id);
  const costs = ts.map((t) => tandaCosts(I, t.id));
  // La tarjeta muestra la tanda más reciente que tenga gastos o cantidades; si no, la primera.
  const actual = [...costs].reverse().find((c) => !M.isZero(c.directo) || c.unidades.n != null) || costs[0] || null;
  return { tandas: costs, actual };
}

/* ---------- Colección ---------- */

export function coleccionCosts(I, coleccionId) {
  const tandas = I.D.tandas.filter((t) => tandaColeccionId(I, t) === coleccionId);
  const tandaSet = new Set(tandas.map((t) => t.id));
  const seen = new Set();
  const take = (gs) => gs.filter((g) => !seen.has(g.id) && seen.add(g.id));

  const prod = take(I.D.gastos.filter((g) => g.categoria === "produccion" && tandaSet.has(g.tanda_id)));
  const publi = take(I.D.gastos.filter((g) => g.categoria === "publicidad" &&
    (tandaSet.has(g.tanda_id) || (!g.tanda_id && g.coleccion_id === coleccionId) ||
      (I.tandasDeGasto.get(g.id) || []).some((id) => tandaSet.has(id)))));
  const productos = [...new Set(tandas.map((t) => t.producto_id))];
  const desa = take(productos.filter((pid) => tandaSet.has(primeraTanda(I, pid)?.id)).flatMap((pid) => gastosDesarrollo(I, pid)));
  const campanas = I.D.campanas.filter((c) => c.coleccion_id === coleccionId);
  const camp = take(campanas.flatMap((c) => (I.gastosDeCampana.get(c.id) || []).filter((g) => g.categoria === "campanas")));

  const tot = (gs) => M.sum(gs.map((g) => M.of(g.moneda, g.monto)));
  const todos = [...prod, ...desa, ...camp, ...publi];
  const pagos = todos.map((g) => ({ g, p: pagoInfo(I, g) }));
  return {
    tandas, productos, campanas,
    lineas: {
      produccion: { total: tot(prod), gastos: prod },
      desarrollo: { total: tot(desa), gastos: desa },
      campana: { total: tot(camp), gastos: camp },
      publicidad: { total: tot(publi), gastos: publi },
    },
    total: tot(todos),
    pagado: M.sum(pagos.map(({ g, p }) => M.of(g.moneda, p.pagado))),
    pendiente: M.sum(pagos.map(({ g, p }) => M.of(g.moneda, p.pendiente))),
    gastos: todos,
  };
}

/* ---------- Gastos sin asignar ---------- */

export function faltaAsignar(g) {
  if (!g.categoria) return true;
  const c = CAT[g.categoria];
  if (!c) return true;
  if (c.destino === "muestra") return !g.muestra_id;
  if (c.destino === "campana") return !g.campana_id;
  if (c.coleccion && (g.coleccion_id || g._multi)) return false;
  if (c.destino === "producto") return c.tanda ? !g.tanda_id : !g.producto_id;
  return false;
}

/* ---------- Costo de un mes (suscripciones repartidas en el período que cubren) ---------- */

export const monthKey = (fecha) => fecha.slice(0, 7);
export function addMonths(key, n) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Devuelve los gastos generales que corresponden a un mes, con el importe que le toca a ese mes.
export function generalesDelMes(I, mes) {
  const out = [];
  for (const g of I.D.gastos) {
    const c = CAT[g.categoria];
    if (!c?.general) continue;
    const meses = g.categoria === "suscripciones" && g.cubre_meses > 1 ? g.cubre_meses : 1;
    const desde = monthKey(g.fecha);
    const hasta = addMonths(desde, meses - 1);
    if (mes < desde || mes > hasta) continue;
    const grande = g.categoria === "equipamiento" || !!g.en_cantidad;
    out.push({ gasto: g, meses, importe: g.monto / meses, grande });
  }
  return out;
}

// Simulación: no crea ni modifica gastos. Solo divide lo elegido por las ventas esperadas.
export function simularCobertura(items, ventas, recuperoMeses) {
  let total = 0;
  for (const it of items) {
    if (!it.incluir) continue;
    total += it.grande ? it.gasto.monto / Math.max(1, recuperoMeses || 12) : it.importe;
  }
  return { total, porUnidad: ventas > 0 ? total / ventas : null };
}

/* ---------- Avisos accionables ---------- */

export function avisos(I) {
  const out = [];
  for (const t of I.D.tandas) {
    const p = I.producto.get(t.producto_id);
    if (!p || p.archivado || t.cerrada) continue;
    const tieneGastos = (I.gastosDeTanda.get(t.id) || []).length > 0 || (I.campanasDeTanda.get(t.id) || []).length > 0;
    const nombre = tandaLabel(I, t);
    if (t.cant_final == null && t.cant_estimada == null && tieneGastos) {
      out.push({ tipo: "cantidad", texto: `${nombre}: falta cargar cantidad`, ruta: `#/producto/${p.id}?tanda=${t.id}` });
    } else if (t.cant_final == null && t.estado === "finalizada") {
      out.push({ tipo: "cantidad", texto: `${nombre}: falta confirmar cantidad final`, ruta: `#/producto/${p.id}?tanda=${t.id}` });
    }
    if (t.estado === "finalizada") {
      const pend = tandaCosts(I, t.id).conceptosPendientes;
      if (pend.length) out.push({ tipo: "concepto", texto: `${nombre}: ${pend.join(", ")} pendiente${pend.length > 1 ? "s" : ""}`, ruta: `#/producto/${p.id}?tanda=${t.id}` });
    }
  }
  for (const c of I.D.campanas) {
    if (c.archivada) continue;
    const info = campaignInfo(I, c.id);
    if (M.isZero(info.total)) continue;
    if (info.estado === "sin_productos") out.push({ tipo: "campana", texto: `Campaña ${c.nombre}: faltan productos participantes`, ruta: `#/campana/${c.id}` });
    else if (info.estado === "falta_cantidad") out.push({ tipo: "campana", texto: `Campaña ${c.nombre}: reparto pendiente (faltan cantidades)`, ruta: `#/campana/${c.id}` });
    else if (info.estado === "estimado") out.push({ tipo: "campana", texto: `Campaña ${c.nombre}: reparto estimado`, ruta: `#/campana/${c.id}` });
  }
  for (const col of I.D.colecciones) {
    const info = publiColeccionInfo(I, col.id);
    if (M.isZero(info.total)) continue;
    if (info.estado === "sin_productos") out.push({ tipo: "campana", texto: `Publicidad de ${col.nombre}: la colección no tiene productos`, ruta: `#/coleccion/${col.id}` });
    else if (info.estado === "falta_cantidad") out.push({ tipo: "campana", texto: `Publicidad de ${col.nombre}: reparto pendiente (faltan cantidades)`, ruta: `#/coleccion/${col.id}` });
  }
  const sinAsignar = I.D.gastos.filter(faltaAsignar);
  if (sinAsignar.length) out.push({ tipo: "asignar", texto: `${sinAsignar.length === 1 ? "Un gasto pendiente" : `${sinAsignar.length} gastos pendientes`} de asignar`, ruta: "#/movimientos?estado=sin_asignar" });

  for (const g of I.D.gastos) {
    const p = pagoInfo(I, g);
    if (p.estado === "parcial") out.push({ tipo: "saldo", texto: `${gastoTitulo(I, g)}: saldo pendiente`, monto: M.of(g.moneda, p.pendiente), ruta: `#/gasto/${g.id}` });
  }
  for (const [a, b] of posiblesDuplicados(I.D.gastos)) {
    out.push({ tipo: "duplicado", texto: `Posible duplicado: ${gastoTitulo(I, a)} (${dm(a.fecha)} y ${dm(b.fecha)})`, ruta: `#/gasto/${b.id}` });
  }
  return out;
}

// Mismo importe, moneda, categoría y destino con menos de 3 días de diferencia.
export function posiblesDuplicados(gastos) {
  const pares = [];
  const sorted = [...gastos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i], b = sorted[j];
      if ((Date.parse(b.fecha) - Date.parse(a.fecha)) / 864e5 > 2) break;
      if (a.monto === b.monto && a.moneda === b.moneda && a.categoria === b.categoria &&
          a.tanda_id === b.tanda_id && a.muestra_id === b.muestra_id && a.campana_id === b.campana_id &&
          a.opcion_id === b.opcion_id && a.coleccion_id === b.coleccion_id && (a.concepto || "") === (b.concepto || "") && !a.notion_id) {
        pares.push([a, b]);
      }
    }
  }
  return pares;
}

/* ---------- Textos ---------- */

const dm = (iso) => `${+iso.slice(8, 10)}/${+iso.slice(5, 7)}`;

export function tandaLabel(I, t) {
  const p = I.producto.get(t.producto_id);
  const varias = (I.tandasDeProducto.get(t.producto_id) || []).length > 1;
  return varias ? `${p?.nombre} · ${t.nombre}` : p?.nombre || t.nombre;
}

export function destinoTexto(I, g) {
  if (g.muestra_id) return I.muestra.get(g.muestra_id)?.nombre;
  if (g.tanda_id) { const t = I.tanda.get(g.tanda_id); return t ? tandaLabel(I, t) : null; }
  if (g.producto_id) return I.producto.get(g.producto_id)?.nombre;
  if (g.campana_id) return I.campana.get(g.campana_id)?.nombre;
  if (g.opcion_id) return I.opcion.get(g.opcion_id)?.nombre;
  if (g.coleccion_id) { const c = I.coleccion.get(g.coleccion_id); return c ? `Colección ${c.nombre}` : null; }
  const multi = I.tandasDeGasto.get(g.id);
  if (multi) return multi.map((id) => I.producto.get(I.tanda.get(id)?.producto_id)?.nombre).filter(Boolean).join(", ");
  return null;
}

export function gastoTitulo(I, g) {
  const dest = destinoTexto(I, g);
  const partes = [g.concepto, dest].filter(Boolean);
  if (partes.length) return partes.join(" · ");
  return g.descripcion || CAT[g.categoria]?.nombre || "Gasto";
}
