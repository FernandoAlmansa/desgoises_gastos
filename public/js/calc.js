// Reglas de cálculo. No toca la pantalla: recibe los datos y devuelve números verificables.
// Los importes están en centavos y se agrupan por moneda ({ ARS: 123, USD: 4 }); nunca se suman monedas distintas.

// multi: se puede cargar a varios productos a la vez (se reparte por unidades). otros: va dentro de "Otros gastos".
export const CATEGORIAS = [
  { key: "muestras", nombre: "Muestras", destino: "muestra", conceptos: "concepto_muestra", icon: "scissors" },
  { key: "produccion", nombre: "Producción de ropa", destino: "producto", tanda: true, conceptos: "concepto_prod", icon: "shirt" },
  { key: "molderia", nombre: "Moldería todos los talles", destino: "producto", multi: true, conceptos: "concepto_molde", icon: "ruler" },
  { key: "campanas", nombre: "Campañas de contenido de colecciones", corto: "Campañas de contenido", destino: "campana", conceptos: "concepto_campana", icon: "camera" },
  { key: "publicidad", nombre: "Publicidad", destino: "producto", tanda: true, multi: true, coleccion: true, icon: "megaphone" },
  { key: "suscripciones", nombre: "Suscripciones y fijos", destino: "opcion", opcionTipo: "suscripcion", general: true, icon: "repeat" },
  { key: "equipamiento", nombre: "Equipamiento", general: true, icon: "wrench" },
  { key: "packaging", nombre: "Packaging y presentación", destino: "opcion", opcionTipo: "packaging", general: true, icon: "package" },
  { key: "posventa", nombre: "Postventa", general: true, otros: true, icon: "rotate" },
  { key: "comisiones", nombre: "Comisiones y cobros", general: true, otros: true, icon: "percent" },
  { key: "administracion", nombre: "Administración e impuestos", general: true, otros: true, icon: "landmark" },
];
export const CAT = Object.fromEntries(CATEGORIAS.map((c) => [c.key, c]));

// Botones al cargar un gasto. "Envíos y cadetes" y "Otros gastos" abren un paso más antes de elegir.
export const MENU_CARGA = [
  ...["muestras", "produccion", "molderia", "campanas", "publicidad", "suscripciones", "equipamiento"].map((k) => CAT[k]),
  { key: "envio", nombre: "Envíos y cadetes", icon: "truck", flujo: "envio" },
  CAT.packaging,
  { key: "otros", nombre: "Otros gastos", icon: "more", flujo: "otros" },
];

// Un envío no es una categoría: se suma al concepto (tela, molde, corte…) al que corresponde.
export const ENVIO = { correo: "Correo", expreso: "Expreso", cadete: "Cadete" };
export const ENVIO_TXT = { correo: "Envío", expreso: "Expreso", cadete: "Cadete" };
// Con tela y moldería el envío se elige por compra (una o varias) y se reparte según lo que costó cada una.
export const esMolde = (concepto) => /^molde/i.test(concepto || "");
export const envioPorCompra = (categoria, concepto) =>
  categoria === "molderia" || ((categoria === "produccion" || categoria === "muestras") && esTela(concepto)) || (categoria === "muestras" && esMolde(concepto));

// Preparación hasta la primera compra de tela de producción; producción después; finalizada al marcarla revisada y cerrada.
export const ESTADO_PROD = { preparacion: "En preparación", produccion: "En producción", finalizada: "Producción finalizada" };
export function estadoProduccion(I, t) {
  if (t.cerrada) return "finalizada";
  return (I.gastosDeTanda.get(t.id) || []).some((g) => g.categoria === "produccion" && esTela(g.concepto)) ? "produccion" : "preparacion";
}

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
  const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
  const gasto = by(D.gastos);

  // Publicidad o moldería cargada a varios productos: el gasto queda sin tanda propia y se reparte entre las suyas.
  const tandasDeGasto = new Map();
  for (const gt of D.gastoTandas || []) push(tandasDeGasto, gt.gasto_id, gt.tanda_id);
  for (const [id, ts] of tandasDeGasto) { const g = gasto.get(id); if (g) { g._multi = true; g._tandas = ts; } }

  // Envío vinculado a una o varias compras (telas o moldes): se parte según lo que costó cada compra
  // y cada parte se suma donde está esa compra, con su mismo concepto.
  const vinculosDe = new Map(), enviosDe = new Map(), partesDe = new Map();
  for (const v of D.gastoVinculos || []) {
    const ref = gasto.get(v.ref_id), g = gasto.get(v.gasto_id);
    if (!ref || !g) continue;
    push(vinculosDe, g.id, ref);
    push(enviosDe, ref.id, g);
  }
  for (const [id, refs] of vinculosDe) {
    const g = gasto.get(id);
    g._vinc = true;
    const split = splitByUnits(g.monto, refs.map((r) => r.monto));
    partesDe.set(id, refs.map((r, i) => ({
      ...g, monto: split[i], categoria: r.categoria, tanda_id: r.tanda_id ?? null, producto_id: r.producto_id ?? null,
      muestra_id: r.muestra_id ?? null, campana_id: null, coleccion_id: null, opcion_id: null,
      _parte: true, _vid: `${g.id}-${r.id}`, _ref: r, _tandas: r._tandas || null, _multi: !!r._tandas,
    })));
  }
  // Lista de gastos con cada envío vinculado reemplazado por sus partes. Es la que usan los cálculos por destino.
  const gastos = D.gastos.flatMap((g) => partesDe.get(g.id) || [g]);

  const I = {
    D, gastos,
    gasto, producto: by(D.productos), tanda: by(D.tandas), muestra: by(D.muestras),
    campana: by(D.campanas), coleccion: by(D.colecciones), opcion: by(D.opciones),
    pagosDe: group(D.pagos, "gasto_id"),
    gastosDeTanda: group(gastos, "tanda_id"),
    gastosDeProducto: group(gastos, "producto_id"),
    gastosDeMuestra: group(gastos, "muestra_id"),
    gastosDeCampana: group(gastos, "campana_id"),
    gastosDeOpcion: group(gastos, "opcion_id"),
    gastosDeColeccion: group(gastos, "coleccion_id"),
    tandasDeProducto: group(D.tandas, "producto_id"),
    muestrasDeProducto: group(D.muestras, "producto_id"),
    noAplica: new Set(D.tandaConceptos.filter((c) => c.estado === "no_aplica").map((c) => `${c.tanda_id}|${c.concepto}`)),
    tandasDeCampana: new Map(), campanasDeTanda: new Map(),
    tandasDeGasto, vinculosDe, enviosDe, partesDe,
    multiDeTanda: new Map(),
    packagingDeProducto: group(D.productoPackaging || [], "producto_id"),
  };
  for (const ct of D.campanaTandas) {
    push(I.tandasDeCampana, ct.campana_id, ct.tanda_id);
    push(I.campanasDeTanda, ct.tanda_id, ct.campana_id);
  }
  for (const g of gastos) for (const t of g._tandas || []) push(I.multiDeTanda, t, g);
  I.campaignCache = new Map();
  I.publiColCache = new Map();
  I.multiCache = new Map();
  return I;
}

const gkey = (g) => g._vid || g.id;

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

// Gastos de las muestras vinculadas al producto.
export function gastosMuestras(I, productoId) {
  return (I.muestrasDeProducto.get(productoId) || []).flatMap((m) => (I.gastosDeMuestra.get(m.id) || []).filter((g) => g.categoria === "muestras"));
}

// Moldería de todos los talles del producto: la propia entera y, si sirve para varios productos,
// la parte que le toca según sus unidades (las de su primera tanda) contra las de los demás.
export function moldesDeProducto(I, productoId, tandaId) {
  const propios = (I.gastosDeProducto.get(productoId) || []).filter((g) => g.categoria === "molderia" && !g._tandas)
    .map((g) => ({ gasto: g, monto: M.of(g.moneda, g.monto), info: null }));
  const compartidos = (I.multiDeTanda.get(tandaId) || []).filter((g) => g.categoria === "molderia").map((g) => {
    const info = multiInfo(I, g);
    return { gasto: g, monto: info.asignado.get(tandaId) || null, info };
  });
  return [...propios, ...compartidos];
}

export function gastosDesarrollo(I, productoId) {
  const t = primeraTanda(I, productoId);
  return [...gastosMuestras(I, productoId), ...(t ? moldesDeProducto(I, productoId, t.id).map((x) => x.gasto) : [])];
}

// La compra de moldería a la que pertenece (un envío vinculado cuenta dentro del molde que mandó).
export const moldeBase = (g) => (g._parte ? g._ref : g);
export function moldeNombre(I, g) {
  const m = moldeBase(g);
  return (m.descripcion || "").trim() || `Moldería ${destinoTexto(I, m) || ""}`.trim();
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

// Publicidad o moldería cargada a varios productos elegidos: se reparte entre las unidades de esas tandas.
export function multiInfo(I, g) {
  const k = gkey(g);
  if (I.multiCache.has(k)) return I.multiCache.get(k);
  const tandas = (g._tandas || []).map((id) => I.tanda.get(id));
  const info = { id: k, gasto: g, ...repartir(M.of(g.moneda, g.monto), tandas, [g]) };
  I.multiCache.set(k, info);
  return info;
}
export const publiMultiInfo = (I, gastoId) => multiInfo(I, I.gasto.get(gastoId));

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
  const muestrasG = esPrimera ? gastosMuestras(I, t.producto_id) : [];
  const moldes = esPrimera ? moldesDeProducto(I, t.producto_id, tandaId) : [];
  const desa = [...muestrasG, ...moldes.map((x) => x.gasto)];

  const campanas = (I.campanasDeTanda.get(tandaId) || []).map((cid) => {
    const c = campaignInfo(I, cid);
    return { campana: I.campana.get(cid), info: c, monto: c.asignado.get(tandaId) || null };
  });

  const colId = tandaColeccionId(I, t);
  const pc = colId != null ? publiColeccionInfo(I, colId) : null;
  const publiCol = pc && !M.isZero(pc.total) ? { coleccion: I.coleccion.get(colId), info: pc, monto: pc.asignado.get(tandaId) || null } : null;

  const publiMulti = (I.multiDeTanda.get(tandaId) || []).filter((g) => g.categoria === "publicidad").map((g) => {
    const info = multiInfo(I, g);
    return { gasto: g, info, monto: info.asignado.get(tandaId) || null };
  });
  const moldesMulti = moldes.filter((x) => x.info);
  const pack = packagingInfo(I, t.producto_id, u.n);

  const tot = (gs) => M.sum(gs.map((g) => M.of(g.moneda, g.monto)));
  const moldeTotal = M.sum(moldes.map((x) => x.monto || {}));
  const lineas = {
    produccion: { total: tot(prod), gastos: prod },
    muestras: { total: tot(muestrasG), gastos: muestrasG, aplica: esPrimera },
    molderia: { total: moldeTotal, items: moldes, aplica: esPrimera },
    desarrollo: { total: M.add(tot(muestrasG), moldeTotal), gastos: desa, aplica: esPrimera },
    packaging: { total: M.sum(pack.map((x) => x.monto || {})), items: pack },
    campana: { total: M.sum(campanas.map((c) => c.monto || {})), campanas },
    publicidad: {
      total: M.sum([tot(publi), publiCol?.monto || {}, ...publiMulti.map((x) => x.monto || {})]),
      gastos: publi, coleccion: publiCol, multi: publiMulti,
    },
  };
  const fabricacion = M.sum([lineas.produccion.total, lineas.muestras.total, lineas.molderia.total, lineas.packaging.total]);
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
  for (const x of moldesMulti) {
    if (x.info.estado === "falta_cantidad" && u.n != null) avisos.push(`Reparto de la moldería “${(x.gasto.descripcion || "").trim() || "sin descripción"}” pendiente: falta cantidad en otro producto`);
  }
  for (const x of pack) {
    if (x.unit == null) avisos.push(`Packaging ${x.opcion?.nombre || ""}: la compra no tiene la cantidad de unidades`);
  }
  const repartos = [...campanas, ...(publiCol ? [publiCol] : []), ...publiMulti, ...moldesMulti].map((x) => x.info.estado);
  const hayEstimados = u.estimada || [...prod, ...desa, ...publi].some((g) => g.estimado) || repartos.includes("estimado");

  let estado;
  if (t.cerrada) estado = "cerrado";
  else if (u.n == null || repartos.includes("falta_cantidad")) estado = "incompleto";
  else if (hayEstimados) estado = "estimado";
  else estado = "al_dia";

  return {
    tanda: t, unidades: u, esPrimera, lineas, fabricacion, directo, estado, avisos, conceptosPendientes, estadoProd: estadoProduccion(I, t),
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
  // Todas las telas (con o sin kilos), para el desplegable de conceptos de producción.
  const porNombre = new Map();
  for (const g of telas) {
    const nombre = telaNombre(g);
    const k = nombre.toLowerCase();
    if (!porNombre.has(k)) porNombre.set(k, { nombre, gastos: [] });
    porNombre.get(k).gastos.push(g);
  }
  return {
    ...medir(conKg),
    telas: [...grupos.values()].map((x) => ({ nombre: x.nombre, ...medir(x.gastos) })),
    porNombre: [...porNombre.values()].map((x) => ({
      nombre: x.nombre, gastos: x.gastos, kg: x.gastos.reduce((s, g) => s + (g.kg || 0), 0), total: M.sum(x.gastos.map((g) => M.of(g.moneda, g.monto))),
    })).sort((a, b) => b.kg - a.kg || M.get(b.total) - M.get(a.total)),
    sinKg: telas.length - conKg.length,
    hayTela: telas.length > 0,
  };
}

const telaNombre = (g) => (g.descripcion || g.proveedor || "Tela").trim();

// Nombres de las telas usadas en una muestra (sin cantidades).
export function telasDeMuestra(I, muestraId) {
  const out = new Map();
  for (const g of I.gastosDeMuestra.get(muestraId) || []) {
    if (esTela(g.concepto)) out.set(telaNombre(g).toLowerCase(), telaNombre(g));
  }
  return [...out.values()];
}

/* ---------- Estampa ---------- */

export const esEstampa = (concepto) => /^estampa/i.test(concepto || "");
// Tipos de estampa. La serigrafía puede ser de un taller (ajena) o hecha por uno mismo, con varias compras.
export const ESTAMPA = { bordado: "Bordado", serigrafia: "Serigrafía ajena", serigrafia_propia: "Serigrafía por mí", dtf: "DTF" };

// Gastos de estampa separados por método: un producto puede tener varios (por ejemplo, bordado y DTF).
export function estampaInfo(gastos) {
  const est = gastos.filter((g) => esEstampa(g.concepto));
  const tipo = (g) => (ESTAMPA[g.estampa] ? g.estampa : null);
  return [...Object.keys(ESTAMPA), null].map((k) => {
    const gs = est.filter((g) => tipo(g) === k);
    return { key: k, nombre: k ? ESTAMPA[k] : "Sin tipo", gastos: gs, total: M.sum(gs.map((g) => M.of(g.moneda, g.monto))) };
  }).filter((x) => x.gastos.length);
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

// Junta importes por grupo (producto, muestra, molde o campaña) para poder desplegarlos.
function grupos(items, grupo) {
  const m = new Map();
  for (const x of items) {
    const gr = grupo(x);
    if (!m.has(gr.key)) m.set(gr.key, { ...gr, items: [] });
    m.get(gr.key).items.push(x);
  }
  return [...m.values()].map((x) => ({ ...x, total: M.sum(x.items.map((i) => i.monto)), gastos: x.items.map((i) => i.gasto) }))
    .sort((a, b) => M.get(b.total) - M.get(a.total));
}
const item = (g) => ({ gasto: g, monto: M.of(g.moneda, g.monto) });

// Lo pagado y pendiente de una parte de un gasto (por ejemplo, la parte de una moldería compartida).
function pagoDeParte(I, g, m) {
  const real = I.gasto.get(g.id) || g;
  const p = pagoInfo(I, real);
  const f = real.monto ? M.get(m, real.moneda) / real.monto : 0;
  return { pagado: M.of(real.moneda, Math.round(p.pagado * f)), pendiente: M.of(real.moneda, Math.round(p.pendiente * f)) };
}

export function coleccionCosts(I, coleccionId) {
  const tandas = I.D.tandas.filter((t) => tandaColeccionId(I, t) === coleccionId);
  const tandaSet = new Set(tandas.map((t) => t.id));
  const seen = new Set();
  const take = (gs) => gs.filter((g) => !seen.has(gkey(g)) && seen.add(gkey(g)));

  const prod = take(I.gastos.filter((g) => g.categoria === "produccion" && tandaSet.has(g.tanda_id))).map(item);
  const publi = take(I.gastos.filter((g) => g.categoria === "publicidad" &&
    (tandaSet.has(g.tanda_id) || (!g.tanda_id && g.coleccion_id === coleccionId) || (g._tandas || []).some((id) => tandaSet.has(id))))).map(item);
  const productos = [...new Set(tandas.map((t) => t.producto_id))];
  // El desarrollo se cuenta en la colección de la primera tanda de cada producto.
  const primeras = productos.map((pid) => primeraTanda(I, pid)).filter((t) => t && tandaSet.has(t.id));
  const mues = take(primeras.flatMap((t) => gastosMuestras(I, t.producto_id))).map(item);
  const moldes = primeras.flatMap((t) => moldesDeProducto(I, t.producto_id, t.id)).filter((x) => x.monto);
  const campanas = I.D.campanas.filter((c) => c.coleccion_id === coleccionId);
  const camp = take(campanas.flatMap((c) => (I.gastosDeCampana.get(c.id) || []).filter((g) => g.categoria === "campanas"))).map(item);

  const linea = (items, grupo) => ({ total: M.sum(items.map((x) => x.monto)), gastos: items.map((x) => x.gasto), items, grupos: grupo ? grupos(items, grupo) : null });
  const L = {
    produccion: linea(prod, (x) => {
      const t = I.tanda.get(x.gasto.tanda_id), p = I.producto.get(t?.producto_id);
      return { key: `t${t?.id}`, nombre: t ? tandaLabel(I, t) : "Producto", ruta: t ? `#/producto/${t.producto_id}?tanda=${t.id}` : null, foto: p?.foto_id };
    }),
    muestras: linea(mues, (x) => ({ key: `m${x.gasto.muestra_id}`, nombre: I.muestra.get(x.gasto.muestra_id)?.nombre || "Muestra", ruta: `#/muestra/${x.gasto.muestra_id}` })),
    molderia: linea(moldes, (x) => ({ key: `mo${moldeBase(x.gasto).id}`, nombre: moldeNombre(I, x.gasto), ruta: `#/gasto/${moldeBase(x.gasto).id}` })),
    campana: linea(camp, (x) => ({ key: `c${x.gasto.campana_id}`, nombre: I.campana.get(x.gasto.campana_id)?.nombre || "Campaña", ruta: `#/campana/${x.gasto.campana_id}` })),
    publicidad: linea(publi),
  };
  L.desarrollo = { total: M.add(L.muestras.total, L.molderia.total), gastos: [...L.muestras.gastos, ...L.molderia.gastos] };
  const fabricacion = M.sum([L.produccion.total, L.muestras.total, L.molderia.total]);
  const todos = [...prod, ...mues, ...moldes, ...camp, ...publi];
  const pagos = todos.map((x) => pagoDeParte(I, x.gasto, x.monto));
  return {
    tandas, productos, campanas, lineas: L, fabricacion,
    total: M.sum([fabricacion, L.campana.total, L.publicidad.total]),
    pagado: M.sum(pagos.map((p) => p.pagado)),
    pendiente: M.sum(pagos.map((p) => p.pendiente)),
    gastos: todos.map((x) => x.gasto),
  };
}

/* ---------- Balance de un período (Resumen) ---------- */

export const inPeriod = (fecha, per) => (per.length === 4 ? fecha.startsWith(per) : monthKey(fecha) === per);
const perDesde = (per) => (per.length === 4 ? `${per}-01-01` : `${per}-01`);
const perHasta = (per) => (per.length === 4 ? `${per}-12-31` : `${per}-31`);

// Una muestra marcada "no se va a producir" pasa a ser un gasto extra de la marca.
export const muestraNoProducida = (I, g) => g.categoria === "muestras" && !!I.muestra.get(g.muestra_id)?.no_produce;
const gastoProductoId = (I, g) => g.producto_id ?? I.tanda.get(g.tanda_id)?.producto_id ?? null;

// A qué muestra, producto, campaña o insumo va cada gasto, para listarlos por nombre.
function grupoDe(I, g) {
  if (g.categoria === "molderia") {
    const m = moldeBase(g);
    return { key: `mo${m.id}`, nombre: moldeNombre(I, g), ruta: `#/gasto/${m.id}` };
  }
  if (g.muestra_id) return { key: `m${g.muestra_id}`, nombre: I.muestra.get(g.muestra_id)?.nombre || "Muestra", ruta: `#/muestra/${g.muestra_id}` };
  const pid = gastoProductoId(I, g);
  if (pid) {
    const p = I.producto.get(pid);
    const molde = g.categoria === "molderia";
    return { key: `${molde ? "mo" : "p"}${pid}`, nombre: `${molde ? "Moldería · " : ""}${p?.nombre || "Producto"}`, ruta: `#/producto/${pid}`, foto: p?.foto_id };
  }
  if (g.campana_id) return { key: `c${g.campana_id}`, nombre: I.campana.get(g.campana_id)?.nombre || "Campaña", ruta: `#/campana/${g.campana_id}` };
  if (g.opcion_id) return { key: `o${g.opcion_id}`, nombre: I.opcion.get(g.opcion_id)?.nombre || "Otro", ruta: `#/opcion/${g.opcion_id}` };
  if (g.coleccion_id || g._multi) return { key: `d${g.coleccion_id ? "c" + g.coleccion_id : "g" + g.id}`, nombre: destinoTexto(I, g) || "Varios productos" };
  return { key: "sin", nombre: "Sin asignar" };
}

function agrupar(I, gastos) {
  const m = new Map();
  for (const g of gastos) {
    const gr = grupoDe(I, g);
    if (!m.has(gr.key)) m.set(gr.key, { ...gr, gastos: [] });
    m.get(gr.key).gastos.push(g);
  }
  return [...m.values()].map((x) => ({ ...x, total: sumGastos(x.gastos) }))
    .sort((a, b) => (a.key === "sin") - (b.key === "sin") || M.get(b.total) - M.get(a.total));
}
const sumGastos = (gs) => M.sum(gs.map((g) => M.of(g.moneda, g.monto)));

// Cada envío vinculado a varias compras se reemplaza por sus partes (suman lo mismo).
export const expandir = (I, gastos) => gastos.flatMap((g) => I.partesDe.get(g.id) || [g]);

// Producción + muestras + moldería = producir ropa; + campañas y publicidad = producir y vender. El resto va aparte.
export function balancePeriodo(I, gastos) {
  gastos = expandir(I, gastos);
  const of = (cat) => gastos.filter((g) => g.categoria === cat);
  const linea = (key, nombre, gs, porNombre = true) => ({ key, nombre, gastos: gs, total: sumGastos(gs), grupos: porNombre ? agrupar(I, gs) : null });
  const produccion = linea("produccion", "Producción", of("produccion"));
  const muestras = linea("muestras", "Muestras", of("muestras").filter((g) => !muestraNoProducida(I, g)));
  const molderia = linea("molderia", "Moldería todos los talles", of("molderia"));
  const campanas = linea("campanas", "Campañas de contenido de colecciones", of("campanas"));
  const publicidad = linea("publicidad", "Publicidad", of("publicidad"));
  const producir = M.sum([produccion.total, muestras.total, molderia.total]);
  const vender = M.sum([producir, campanas.total, publicidad.total]);
  // Postventa, comisiones y administración van juntas en "Otros gastos", separadas por tipo.
  const otros = linea("otros", "Otros gastos", gastos.filter((g) => CAT[g.categoria]?.otros), false);
  otros.grupos = CATEGORIAS.filter((c) => c.otros).map((c) => {
    const gs = of(c.key);
    return { key: c.key, nombre: c.nombre, gastos: gs, total: sumGastos(gs) };
  }).filter((x) => x.gastos.length);
  const noAsignados = [
    linea("equipamiento", "Equipamiento", of("equipamiento"), false),
    linea("packaging", "Packaging y presentación", of("packaging")),
    linea("suscripciones", "Suscripciones y fijos", of("suscripciones")),
    linea("sin", "Sin categoría", gastos.filter((g) => !CAT[g.categoria]), false),
    linea("no_producidas", "Muestras no producidas", gastos.filter((g) => muestraNoProducida(I, g))),
    otros,
  ].filter((x) => x.gastos.length);
  return {
    produccion, muestras, molderia, producir, campanas, publicidad, vender,
    noAsignados, totalNoAsignados: M.sum(noAsignados.map((x) => x.total)),
  };
}

/* ---------- Conclusión del período ---------- */

// Orden de la producción. Un gasto de un paso significa que el producto ya está en el paso siguiente.
const PASOS = [
  { re: /^tela/i, hecho: "tela comprada", nombre: "Tela" },
  { re: /^corte/i, hecho: "cortado", nombre: "Corte" },
  { re: /^estampa/i, hecho: "estampado", nombre: "Estampa" },
  { re: /^confecc/i, hecho: "confeccionado", nombre: "Confección" },
  { re: /^lavader/i, hecho: "lavado", nombre: "Lavadero" },
];

// Fecha en que se marcó "Revisada y cerrada" (del historial); si no está, el último gasto de la tanda.
function fechaCierre(I, t) {
  for (const h of I.D.historial || []) {
    if (h.entidad !== "tandas" || h.entidad_id !== t.id) continue;
    try { if (JSON.parse(h.detalle).cerrada?.[1]) return h.fecha.slice(0, 10); } catch {}
  }
  const gs = I.gastosDeTanda.get(t.id) || [];
  return gs.reduce((max, g) => (g.fecha > max ? g.fecha : max), (t.creado || "").slice(0, 10));
}

// En qué paso está una tanda al final del período.
export function pasoTanda(I, t, hasta) {
  if (t.cerrada && fechaCierre(I, t) <= hasta) return { estado: "Terminado", hecho: null, sigue: null, terminado: true };
  const prod = (I.gastosDeTanda.get(t.id) || []).filter((g) => g.categoria === "produccion" && g.fecha <= hasta);
  let ultimo = -1;
  for (const g of prod) PASOS.forEach((p, i) => { if (p.re.test(g.concepto || "") && i > ultimo) ultimo = i; });
  if (ultimo < 0) return { estado: prod.length ? "En producción" : "Por empezar", hecho: null, sigue: null, terminado: false };
  const noAplica = (p) => I.D.tandaConceptos.some((c) => c.tanda_id === t.id && c.estado === "no_aplica" && p.re.test(c.concepto));
  const sigue = PASOS.slice(ultimo + 1).find((p) => !noAplica(p)) || null;
  return { estado: sigue ? `En ${sigue.nombre.toLowerCase()}` : "Lista para cerrar", hecho: PASOS[ultimo].hecho, sigue: sigue?.nombre || null, terminado: false };
}

// Datos para la conclusión escrita del Resumen. Se calcula sola con lo cargado: no hay que tocar nada.
export function conclusionPeriodo(I, per) {
  const desde = perDesde(per), hasta = perHasta(per);
  const gastos = I.D.gastos.filter((g) => inPeriod(g.fecha, per));
  const b = balancePeriodo(I, gastos);
  const total = sumGastos(gastos);
  const ars = (m) => M.get(m);
  const pct = (a, b) => (ars(b) ? (ars(a) / ars(b)) * 100 : null);

  const rubros = [
    { key: "produccion", nombre: "producción", total: b.produccion.total },
    { key: "muestras", nombre: "muestras", total: b.muestras.total },
    { key: "molderia", nombre: "moldería de todos los talles", total: b.molderia.total },
    { key: "campanas", nombre: "campañas de contenido", total: b.campanas.total },
    { key: "publicidad", nombre: "publicidad", total: b.publicidad.total },
    { key: "fuera", nombre: "gastos fuera de producción", total: b.totalNoAsignados },
  ].filter((r) => ars(r.total) > 0).map((r) => ({ ...r, pct: pct(r.total, total) }));
  const principal = rubros.slice().sort((a, b) => ars(b.total) - ars(a.total))[0] || null;

  // Colecciones con gastos de producción en el período: cuáles empezaron, cuáles se terminaron.
  const prodGastos = b.produccion.gastos.filter((g) => g.tanda_id);
  const colIds = [...new Set(prodGastos.map((g) => tandaColeccionId(I, I.tanda.get(g.tanda_id) || {})))];
  const colecciones = colIds.map((colId) => {
    const tandas = I.D.tandas.filter((t) => tandaColeccionId(I, t) === colId && (t.creado || "").slice(0, 10) <= hasta &&
      !I.producto.get(t.producto_id)?.archivado);
    const ids = new Set(tandas.map((t) => t.id));
    const todos = I.gastos.filter((g) => g.categoria === "produccion" && ids.has(g.tanda_id));
    const inicio = todos.reduce((min, g) => (!min || g.fecha < min ? g.fecha : min), null);
    const pasos = tandas.map((t) => ({ tanda: t, producto: I.producto.get(t.producto_id), ...pasoTanda(I, t, hasta) }));
    const terminada = pasos.length > 0 && pasos.every((p) => p.terminado);
    const fin = terminada ? tandas.reduce((max, t) => { const f = fechaCierre(I, t); return f > max ? f : max; }, "") : null;
    const empezo = !!inicio && inicio >= desde;
    const termino = terminada && fin >= desde;
    return {
      coleccion: colId != null ? I.coleccion.get(colId) : null,
      estado: empezo && termino ? "completa" : termino ? "terminada" : empezo ? "comenzada" : terminada ? "terminada_antes" : "en_curso",
      gastado: sumGastos(prodGastos.filter((g) => ids.has(g.tanda_id))),
      productos: pasos.filter((p) => (I.gastosDeTanda.get(p.tanda.id) || []).some((g) => g.fecha <= hasta) || p.terminado),
    };
  }).sort((a, b) => ars(b.gastado) - ars(a.gastado));

  // Campañas: cuánto pesan en el mes y en el costo total de su colección.
  const campanas = agrupar(I, b.campanas.gastos).filter((x) => x.key !== "sin").map((x) => {
    const c = I.campana.get(Number(x.key.slice(1)));
    const col = c?.coleccion_id != null ? I.coleccion.get(c.coleccion_id) : null;
    return {
      campana: c, coleccion: col, total: x.total, pctMes: pct(x.total, total),
      pctColeccion: col ? pct(campaignInfo(I, c.id).total, coleccionCosts(I, col.id).total) : null,
    };
  });

  const muestraIds = [...new Set(gastos.filter((g) => g.categoria === "muestras" && g.muestra_id).map((g) => g.muestra_id))];
  const muestras = {
    n: muestraIds.length,
    total: sumGastos(gastos.filter((g) => g.categoria === "muestras")),
    noProducen: muestraIds.filter((id) => I.muestra.get(id)?.no_produce).length,
    vinculadas: muestraIds.filter((id) => I.muestra.get(id)?.producto_id).length,
  };

  // Compras únicas (equipamiento) que hacen que el período salga más caro.
  const unicos = b.noAsignados.find((x) => x.key === "equipamiento")?.gastos.slice().sort((a, b) => b.monto - a.monto).slice(0, 2)
    .map((g) => ({ gasto: g, pct: pct(M.of(g.moneda, g.monto), total) })) || [];

  // Pagos hechos en el período de gastos de antes (saldos de colecciones anteriores, por ejemplo).
  const saldosAnteriores = M.sum(I.D.pagos.filter((p) => inPeriod(p.fecha, per)).map((p) => {
    const g = I.gasto.get(p.gasto_id);
    return g && g.fecha < desde ? M.of(g.moneda, p.monto) : {};
  }));

  return {
    total, n: gastos.length, rubros, principal, balance: b, colecciones, campanas, muestras, unicos, saldosAnteriores,
    fuera: { total: b.totalNoAsignados, pct: pct(b.totalNoAsignados, total) },
  };
}

/* ---------- Gastos sin asignar ---------- */

export function faltaAsignar(g) {
  if (!g.categoria) return true;
  const c = CAT[g.categoria];
  if (!c) return true;
  if (g._vinc) return false; // envío repartido entre compras de tela o moldería
  if (c.destino === "muestra") return !g.muestra_id;
  if (c.destino === "campana") return !g.campana_id;
  if (c.multi && g._multi) return false;
  if (c.coleccion && g.coleccion_id) return false;
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
  const multi = g._tandas || I.tandasDeGasto.get(g.id);
  if (multi) return multi.map((id) => I.producto.get(I.tanda.get(id)?.producto_id)?.nombre).filter(Boolean).join(", ");
  const refs = I.vinculosDe?.get(g.id);
  if (refs) return refs.map((r) => compraNombre(I, r)).join(", ");
  return null;
}

// Nombre de una compra de tela o moldería: lo que dice la descripción y para qué es.
export function compraNombre(I, g) {
  const desc = (g.descripcion || "").trim() || g.concepto || CAT[g.categoria]?.nombre || "Compra";
  const dest = g.categoria === "molderia" ? null : destinoTexto(I, g);
  return dest ? `${desc} (${dest})` : desc;
}

export function gastoTitulo(I, g) {
  const dest = destinoTexto(I, g);
  const partes = [g.concepto, dest].filter(Boolean);
  if (partes.length) return partes.join(" · ");
  return g.descripcion || CAT[g.categoria]?.nombre || "Gasto";
}
