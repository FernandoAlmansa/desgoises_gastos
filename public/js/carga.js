// Carga y edición de un gasto: Monto → categoría → selección → detalle → guardar.
import {
  CATEGORIAS, CAT, MENU_CARGA, ENVIO, ENVIO_TXT, pagoInfo, tandaColeccionId, unidades, esTela, esEstampa, esMolde, ESTAMPA,
  envioPorCompra, destinoTexto, primeraTanda, PUBLI, esAvio,
} from "./calc.js";
import {
  icon, esc, $, $$, money, parseAmount, liveFormat, centsToInput, today, fmtDate, api, toast, sheet, busy,
  uploadFile, fileUrl, plural, promptSheet, parseKg, fmtKg, fmtInt,
} from "./ui.js";

const LAST_MEDIO = "dg_ultimo_medio";
const lastMedio = () => { try { return localStorage.getItem(LAST_MEDIO); } catch { return null; } };

const DESTINO_TXT = {
  muestra: { titulo: "¿Qué muestra?", nuevo: "Añadir nueva muestra", label: "Nombre de la muestra", ej: "Ej.: Jogging ancho" },
  producto: { titulo: "¿Qué producto?", nuevo: "Añadir nuevo producto", label: "Nombre del producto", ej: "Ej.: Crewneck negro" },
  campana: { titulo: "¿Qué campaña?", nuevo: "Añadir nueva campaña", label: "Nombre de la campaña", ej: "Ej.: Campaña Archive" },
  suscripcion: { titulo: "¿Qué servicio?", nuevo: "Agregar nuevo", label: "Nombre del servicio", ej: "Ej.: Canva" },
  packaging: { titulo: "¿Qué compraste?", nuevo: "Agregar nuevo", label: "Nombre del insumo", ej: "Ej.: Cajas" },
};
const STAMP_OPC = [["bordado", "Bordado"], ["serigrafia", "Serigrafía"], ["dtf", "DTF"]];
const DESC_EJ = {
  muestras: "Ej.: Segunda prueba de talle", produccion: "Ej.: Tela rústica negra 40 m", molderia: "Ej.: Moldes y progresión de talles",
  campanas: "Ej.: Estudio medio día", publicidad: "Ej.: Instagram, 7 días", suscripciones: "Ej.: Plan mensual",
  posventa: "Ej.: Cambio de talle a Córdoba", equipamiento: "Ej.: Plancha industrial", comisiones: "Ej.: Comisión Mercado Pago",
  administracion: "Ej.: Monotributo octubre", packaging: "Ej.: Etiquetas tejidas con logo",
};

/**
 * Abre la carga. ctx = { I: () => índice actual, reload: () => Promise, go: (hash) => void }
 * gasto: si viene, edita ese gasto.
 */
export function openCarga(ctx, gasto = null, preset = {}) {
  const editing = !!gasto;
  const st = editing ? { ...gasto } : {
    monto: null, moneda: "ARS", categoria: null, fecha: today(), medio_pago: lastMedio(),
    estadoPago: "pagado", estimado: 0, en_cantidad: 0, cubre_meses: 1, ...preset,
  };
  st.step = editing ? "detalle" : "monto";
  let saved = null;

  const sh = sheet({
    title: editing ? "Editar gasto" : "Nuevo gasto",
    full: true,
    foot: true,
    render: () => {},
  });
  const body = sh.body;
  const foot = sh.foot;

  const I = () => ctx.I();
  const cat = () => CAT[st.categoria];
  // Publicidad o moldería repartida entre varios productos: se guardan las tandas elegidas aparte.
  // Envío vinculado a compras de tela o moldería: se guardan esas compras.
  // Datos de cada producto del gasto (por tanda): ventas en la publicidad de conversión y avíos que lleva cada prenda.
  st.pesos = new Map();
  if (editing) {
    st.multi = I().tandasDeGasto.get(gasto.id)?.slice() || null;
    const refs = I().vinculosDe.get(gasto.id);
    st.vinc = refs ? new Set(refs.map((r) => r.id)) : null;
    for (const f of I().filasDeGasto.get(gasto.id) || []) st.pesos.set(f.tanda_id, { ventas: f.ventas, por_prenda: f.por_prenda });
  }
  if (st.categoria === "publicidad" && !st.publi_tipo && editing) st.publi_tipo = "visibilidad";

  function clearDestino() {
    for (const k of ["muestra_id", "producto_id", "tanda_id", "campana_id", "opcion_id", "coleccion_id", "concepto", "cantidad", "kg", "multi", "sel", "vinc"]) st[k] = null;
    st.pesos = new Map();
  }
  const esConv = () => st.categoria === "publicidad" && st.publi_tipo === "conversion";
  const esAvioCarga = () => st.categoria === "produccion" && !st.envio && esAvio(st.concepto);
  // Tandas del gasto: las elegidas (varios productos) o la única.
  const tandasSel = () => (st.multi?.length ? st.multi : st.tanda_id ? [st.tanda_id] : []);
  // De cada producto, la tanda abierta más reciente (o la última, si están todas cerradas).
  const tandaActual = (pid) => {
    const ts = (I().tandasDeProducto.get(pid) || []).slice().sort((a, b) => b.id - a.id);
    return (ts.find((t) => !t.cerrada) || ts[0])?.id;
  };

  function crumbs() {
    const items = [];
    if (st.monto) items.push(["monto", money(st.monto, st.moneda)]);
    if (st.envio) {
      items.push(["envio", ENVIO[st.envio]]);
      if (st.concepto) items.push(["envioConc", st.concepto]);
    } else if (st.categoria) items.push([CAT[st.categoria]?.otros ? "otros" : "monto", cat()?.corto || cat()?.nombre]);
    if (st.categoria === "publicidad" && st.publi_tipo) items.push(["publiTipo", PUBLI[st.publi_tipo]]);
    const dest = destinoNombre();
    if (dest) items.push([st.vinc?.size ? "vinculos" : "destino", dest]);
    if (esConv() && dest && st.step !== "ventas") {
      const v = tandasSel().reduce((s, t) => s + (st.pesos.get(t)?.ventas || 0), 0);
      items.push(["ventas", `${fmtInt(v)} ${v === 1 ? "venta" : "ventas"}`]);
    }
    if (st.tanda_id && cat()?.tanda) {
      const t = I().tanda.get(st.tanda_id);
      if (t && (I().tandasDeProducto.get(t.producto_id) || []).length > 1) items.push(["tanda", t.nombre]);
    }
    return `<div class="crumbs">${items.map(([step, txt]) =>
      `<button type="button" class="crumb" data-go="${step}" aria-label="Cambiar ${esc(txt)}">${esc(txt)} ${icon("pencil")}</button>`).join("")}</div>`;
  }
  function destinoNombre() {
    const i = I();
    if (st.vinc?.size) {
      const tipo = esTela(st.concepto) ? ["tela", "telas"] : ["moldería", "molderías"];
      if (st.vinc.size > 1) return `${st.vinc.size} ${tipo[1]}`;
      const r = i.gasto.get([...st.vinc][0]);
      return (r?.descripcion || "").trim() || `1 ${tipo[0]}`;
    }
    if (st.multi?.length) return `${st.multi.length} productos`;
    if (st.muestra_id) return i.muestra.get(st.muestra_id)?.nombre;
    if (st.producto_id) return i.producto.get(st.producto_id)?.nombre;
    if (st.campana_id) return i.campana.get(st.campana_id)?.nombre;
    if (st.opcion_id) return i.opcion.get(st.opcion_id)?.nombre;
    if (st.coleccion_id) { const c = i.coleccion.get(st.coleccion_id); return c ? `Colección ${c.nombre}` : null; }
    return null;
  }

  function go(step) { st.step = step; render(); body.scrollTop = 0; }

  function render() {
    foot.parentElement.hidden = false;
    if (st.step === "monto") renderMonto();
    else if (st.step === "envio") renderEnvio();
    else if (st.step === "envioConc") renderEnvioConc();
    else if (st.step === "vinculos") renderVinculos();
    else if (st.step === "otros") renderOtros();
    else if (st.step === "publiTipo") renderPubliTipo();
    else if (st.step === "ventas") renderVentas();
    else if (st.step === "destino") renderDestino();
    else if (st.step === "tanda") renderTanda();
    else if (st.step === "detalle") renderDetalle();
    else if (st.step === "listo") renderListo();
    $$("[data-go]", body).forEach((b) => (b.onclick = () => go(b.dataset.go)));
  }

  /* ---------- Paso 1: importe y categoría ---------- */
  function renderMonto() {
    body.innerHTML = `
      <div class="amount-box">
        <label for="c-monto" class="hero-label">Importe</label>
        <div class="amount-line" id="c-line">
          <button type="button" class="amount-cur" id="c-cur" aria-label="Cambiar moneda">${st.moneda === "USD" ? "US$" : "$"}</button>
          <input id="c-monto" class="amount-input" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(centsToInput(st.monto))}">
        </div>
        <div class="error-text" id="c-err" hidden>Ingresá el importe primero</div>
      </div>
      <div class="stack-sm">
        <div class="hero-label">¿En qué se gastó?</div>
        <div class="cat-grid">
          ${MENU_CARGA.map((c) => `<button type="button" class="cat-btn" data-cat="${c.key}" ${elegida(c) ? 'aria-pressed="true"' : ""}>
            <span class="ico-box">${icon(c.icon)}</span><span>${esc(c.nombre)}</span>${c.flujo ? icon("right", "chev") : ""}</button>`).join("")}
        </div>
      </div>`;
    foot.parentElement.hidden = true;
    const inp = $("#c-monto", body);
    inp.oninput = () => { liveFormat(inp); $("#c-err", body).hidden = true; $("#c-line", body).classList.remove("invalid"); };
    $("#c-cur", body).onclick = (e) => { st.moneda = st.moneda === "USD" ? "ARS" : "USD"; e.currentTarget.textContent = st.moneda === "USD" ? "US$" : "$"; };
    if (!editing && !st.monto) setTimeout(() => inp.focus(), 80);
    $$("[data-cat]", body).forEach((b) => (b.onclick = () => {
      const m = parseAmount(inp.value);
      if (!m) {
        $("#c-err", body).hidden = false;
        const line = $("#c-line", body);
        line.classList.remove("invalid"); void line.offsetWidth; line.classList.add("invalid");
        inp.focus();
        return;
      }
      st.monto = m;
      const k = b.dataset.cat;
      if (k === "envio") return go("envio");
      if (k === "otros") return go("otros");
      const keepDestino = !st.envio && st.categoria === k && (destinoNombre() || !CAT[k].destino);
      if (!keepDestino) { clearDestino(); st.envio = null; st.categoria = k; st.publi_tipo = null; }
      // Publicidad: primero se elige si es de conversión o de visibilidad/tráfico.
      if (k === "publicidad" && (!keepDestino || !st.publi_tipo)) return go("publiTipo");
      if (keepDestino || !cat().destino) go("detalle");
      else go("destino");
    }));
  }
  function elegida(c) {
    if (c.flujo === "envio") return !!st.envio;
    if (c.flujo === "otros") return !st.envio && !!CAT[st.categoria]?.otros;
    return !st.envio && st.categoria === c.key;
  }

  // Lista de filas para elegir una opción (tipo de envío, tipo de otro gasto…).
  const opcionRows = (xs, attr) => `<div class="card flush"><ul class="list">${xs.map((x) => `<li data-name="${esc(x.nombre.toLowerCase())}">
    <button type="button" class="row" data-${attr}="${esc(x.key)}" ${x.on ? 'aria-pressed="true"' : ""}>
    ${x.icon ? `<span class="ico-box">${icon(x.icon)}</span>` : ""}<span class="row-main"><span class="row-title wrap">${esc(x.nombre)}</span>${x.sub ? `<span class="row-sub wrap">${esc(x.sub)}</span>` : ""}</span>
    ${icon("right", "chev")}</button></li>`).join("")}</ul></div>`;

  /* ---------- Envíos y cadetes: tipo → concepto → a qué compra, muestra, producto o campaña ---------- */
  function renderEnvio() {
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿Cómo se mandó?</h3>
      ${opcionRows([["correo", "Correo", "mail"], ["expreso", "Expreso", "truck"], ["flete", "Flete", "van"], ["cadete", "Cadete", "bike"]]
        .map(([key, nombre, ic]) => ({ key, nombre, icon: ic, on: st.envio === key })), "env")}
      <p class="hint" style="margin:0">No es una categoría aparte: el envío se suma al concepto que elijas (tela, molde, corte…) en la muestra, producto o campaña que corresponda.</p>`;
    foot.parentElement.hidden = true;
    $$("[data-env]", body).forEach((b) => (b.onclick = () => {
      if (st.envio !== b.dataset.env && !st.envio) { clearDestino(); st.categoria = null; }
      st.envio = b.dataset.env;
      go("envioConc");
    }));
  }

  // Todos los conceptos juntos, por sección. Tela y moldería después preguntan qué compra/s; el resto, a qué destino.
  function renderEnvioConc() {
    const i = I();
    const secciones = [
      ["muestras", "Conceptos de muestras", "concepto_muestra"],
      ["produccion", "Conceptos de producción", "concepto_prod"],
      ["molderia", "Conceptos de moldería todos los talles", "concepto_molde"],
      ["campanas", "Conceptos de campañas de contenido", "concepto_campana"],
    ];
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿${ENVIO_TXT[st.envio]} relacionado a qué?</h3>
      <div class="search">${icon("search")}<input class="input" id="d-q" type="search" placeholder="Buscar concepto" aria-label="Buscar concepto" autocomplete="off"></div>
      ${secciones.map(([catKey, titulo, tipo]) => {
        const ops = i.D.opciones.filter((o) => o.tipo === tipo && !o.archivada);
        if (!ops.length) return "";
        return `<div class="stack-sm" data-sec><div class="hero-label">${esc(titulo)}</div>
          ${opcionRows(ops.map((o) => ({ key: `${catKey}|${o.nombre}`, nombre: o.nombre, on: st.categoria === catKey && st.concepto === o.nombre,
            sub: envioPorCompra(catKey, o.nombre) ? "Elegís la compra (una o varias)" : null })), "conc")}</div>`;
      }).join("")}`;
    foot.parentElement.hidden = true;
    const q = $("#d-q", body);
    q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      $$("li[data-name]", body).forEach((li) => (li.hidden = v && !li.dataset.name.includes(v)));
      $$("[data-sec]", body).forEach((s) => (s.hidden = !$$("li[data-name]", s).some((li) => !li.hidden)));
    };
    $$("[data-conc]", body).forEach((b) => (b.onclick = () => {
      const [catKey, concepto] = b.dataset.conc.split(/\|(.*)/s);
      const mismo = st.categoria === catKey && st.concepto === concepto && (destinoNombre() || st.vinc?.size);
      if (!mismo) { clearDestino(); st.categoria = catKey; st.concepto = concepto; }
      if (mismo) return go("detalle");
      go(envioPorCompra(catKey, concepto) ? "vinculos" : "destino");
    }));
  }

  // Compras de tela o moldería, de la más nueva a la más vieja. Con varias, el envío se reparte por lo que costó cada una.
  function comprasParaEnvio() {
    return I().D.gastos.filter((g) => !g.envio && g.categoria === st.categoria &&
      (st.categoria === "molderia" || (esTela(st.concepto) ? esTela(g.concepto) : esMolde(g.concepto))))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  }
  function renderVinculos() {
    const i = I();
    const tela = esTela(st.concepto);
    const compras = comprasParaEnvio();
    if (!st.vinc) st.vinc = new Set();
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿${ENVIO_TXT[st.envio]} relacionado a qué ${tela ? "tela/s" : "moldería/s"}?</h3>
      ${compras.length ? `${compras.length > 6 ? `<div class="search">${icon("search")}<input class="input" id="d-q" type="search" placeholder="Buscar" aria-label="Buscar" autocomplete="off"></div>` : ""}
      <div class="card flush"><ul class="list">${compras.map((g) => `<li data-name="${esc(((g.descripcion || "") + " " + (destinoTexto(i, g) || "")).toLowerCase())}">
        <button type="button" class="row" data-toggle="${g.id}" aria-pressed="${st.vinc.has(g.id)}">
        <span class="row-main"><span class="row-title wrap">${esc((g.descripcion || "").trim() || g.concepto || "Sin descripción")}</span>
        <span class="row-sub wrap">${esc([destinoTexto(i, g), fmtDate(g.fecha)].filter(Boolean).join(" · "))}</span></span>
        <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b></span>
        <span class="check" aria-hidden="true">${icon("check", "sm")}</span></button></li>`).join("")}</ul></div>`
      : `<div class="note">${icon("alert", "sm")}<span>Todavía no hay compras de ${tela ? "tela" : "moldería"} ${st.categoria === "muestras" ? "de muestras" : st.categoria === "produccion" ? "de producción" : ""} cargadas. Podés elegir directamente a qué ${st.categoria === "muestras" ? "muestra" : "producto"} va el envío.</span></div>
        <button type="button" class="btn secondary block" id="v-dest">Elegir ${st.categoria === "muestras" ? "muestra" : "producto"}</button>`}`;
    foot.parentElement.hidden = !compras.length;
    const seguir = () => {
      const n = st.vinc.size;
      foot.innerHTML = `<button class="btn block" id="v-next" ${n ? "" : "disabled"}>${n ? `Seguir con ${n === 1 ? "1 compra" : `${n} compras`}` : "Elegí una o varias"}</button>
        ${n > 1 ? `<p class="hint" style="margin:8px 0 0;text-align:center">El envío se reparte según lo que costó cada una.</p>` : ""}`;
      $("#v-next", foot).onclick = () => go("detalle");
    };
    if (compras.length) seguir();
    $$("[data-toggle]", body).forEach((b) => (b.onclick = () => {
      const id = Number(b.dataset.toggle);
      st.vinc.has(id) ? st.vinc.delete(id) : st.vinc.add(id);
      b.setAttribute("aria-pressed", String(st.vinc.has(id)));
      seguir();
    }));
    const q = $("#d-q", body);
    if (q) q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      $$("li[data-name]", body).forEach((li) => (li.hidden = v && !li.dataset.name.includes(v)));
    };
    $("#v-dest", body)?.addEventListener("click", () => { st.vinc = null; go("destino"); });
  }

  /* ---------- Publicidad: de conversión o de visibilidad/tráfico ---------- */
  function renderPubliTipo() {
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿Qué tipo de publicidad?</h3>
      ${opcionRows([
        { key: "conversion", nombre: "De conversión", icon: "target", sub: "Anuncios para vender. Después ponés cuántas se vendieron de cada producto.", on: st.publi_tipo === "conversion" },
        { key: "visibilidad", nombre: "Visibilidad / Tráfico", icon: "eye", sub: "No genera ventas directas. Se reparte según las unidades producidas.", on: st.publi_tipo === "visibilidad" },
      ], "ptipo")}
      <p class="hint" style="margin:0">Quedan separadas: el costo por venta de la conversión se promedia entre cargas; la visibilidad nunca se mezcla con ese promedio.</p>`;
    foot.parentElement.hidden = true;
    $$("[data-ptipo]", body).forEach((b) => (b.onclick = () => {
      st.publi_tipo = b.dataset.ptipo;
      if (st.publi_tipo === "conversion") {
        // La conversión se carga por producto: si venía una colección, se abre en sus productos.
        if (st.coleccion_id) return elegirProductosConv(productosDeColeccion(st.coleccion_id));
        return go(tandasSel().length ? "ventas" : "destino");
      }
      go(destinoNombre() ? "detalle" : "destino");
    }));
  }

  const productosDeColeccion = (colId) => {
    const i = I();
    return [...new Set(i.D.tandas.filter((t) => tandaColeccionId(i, t) === colId).map((t) => t.producto_id))]
      .filter((pid) => i.producto.get(pid) && !i.producto.get(pid).archivado);
  };
  // Conversión: un producto conserva su tanda; varios quedan repartidos (las ventas de cada uno deciden cuánto le toca).
  function elegirProductosConv(ids) {
    if (!ids.length) { toast("Esa colección todavía no tiene productos", true); return; }
    const pesos = st.pesos;
    clearDestino();
    if (ids.length === 1) { st.producto_id = ids[0]; st.tanda_id = tandaActual(ids[0]); }
    else st.multi = ids.map(tandaActual).filter(Boolean);
    st.sel = new Set(ids);
    for (const t of tandasSel()) if (pesos.has(t)) st.pesos.set(t, pesos.get(t));
    go("ventas");
  }

  function renderVentas() {
    const i = I();
    const ts = tandasSel().map((id) => i.tanda.get(id)).filter(Boolean);
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿Cuántas se vendieron?</h3>
      <p class="hint" style="margin:0">De cada producto, las ventas que trajo este gasto (lo que te dice Meta). Se reparte según eso.</p>
      <div class="card flush"><ul class="list">${ts.map((t) => {
        const p = i.producto.get(t.producto_id);
        const v = st.pesos.get(t.id)?.ventas;
        return `<li><label class="row" for="v-${t.id}">${p?.foto_id ? `<span class="thumb"><img src="${fileUrl(p.foto_id, true)}" alt="" loading="lazy"></span>` : `<span class="ico-box">${icon("shirt")}</span>`}
          <span class="row-main"><span class="row-title wrap">${esc(p?.nombre || "Producto")}</span><span class="row-sub">${esc(i.coleccion.get(tandaColeccionId(i, t))?.nombre || "Sin colección")}</span></span>
          <input id="v-${t.id}" class="input num-in" data-v="${t.id}" inputmode="numeric" placeholder="0" value="${v ? v : ""}" aria-label="Ventas de ${esc(p?.nombre || "")}"></label></li>`;
      }).join("")}</ul></div>
      <p class="hint" style="margin:0">Si no se vendió nada, dejalo en 0: la plata se reparte por unidades producidas y sube el costo por venta.</p>`;
    const total = () => $$("[data-v]", body).reduce((s, x) => s + (Number(x.value) || 0), 0);
    const seguir = () => {
      const n = total();
      foot.innerHTML = `<button class="btn block" id="v-next">Seguir · ${fmtInt(n)} ${n === 1 ? "venta" : "ventas"}</button>
        ${n ? `<p class="hint" style="margin:8px 0 0;text-align:center">${money(st.monto / n, st.moneda, true)} por venta en esta carga</p>` : ""}`;
      $("#v-next", foot).onclick = () => {
        for (const x of $$("[data-v]", body)) st.pesos.set(Number(x.dataset.v), { ...(st.pesos.get(Number(x.dataset.v)) || {}), ventas: Number(x.value) || 0 });
        go("detalle");
      };
    };
    $$("[data-v]", body).forEach((x) => (x.oninput = () => { x.value = x.value.replace(/\D/g, ""); seguir(); }));
    seguir();
  }

  /* ---------- Otros gastos: postventa, comisiones y cobros, administración e impuestos ---------- */
  function renderOtros() {
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿Qué tipo de gasto?</h3>
      ${opcionRows(CATEGORIAS.filter((c) => c.otros).map((c) => ({ key: c.key, nombre: c.nombre, icon: c.icon, on: !st.envio && st.categoria === c.key })), "otro")}`;
    foot.parentElement.hidden = true;
    $$("[data-otro]", body).forEach((b) => (b.onclick = () => {
      if (st.envio || st.categoria !== b.dataset.otro) { clearDestino(); st.envio = null; st.categoria = b.dataset.otro; }
      go("detalle");
    }));
  }

  /* ---------- Paso 2: selección (muestra, producto, campaña, servicio o insumo) ---------- */
  function listItems() {
    const i = I(), D = i.D, c = cat();
    if (c.destino === "muestra") {
      return D.muestras.filter((m) => !m.archivada).map((m) => {
        const n = (i.gastosDeMuestra.get(m.id) || []).length;
        const prod = m.producto_id ? i.producto.get(m.producto_id)?.nombre : null;
        return { id: m.id, nombre: m.nombre, sub: [prod && `Vinculada a ${prod}`, m.no_produce && "No se va a producir", n ? plural(n, "gasto") : "Sin gastos"].filter(Boolean).join(" · "), foto: m.foto_id, icon: "scissors" };
      });
    }
    if (c.destino === "producto") {
      return D.productos.filter((p) => !p.archivado).map((p) => ({
        id: p.id, nombre: p.nombre, sub: i.coleccion.get(p.coleccion_id)?.nombre || "Sin colección", foto: p.foto_id, icon: "shirt",
      }));
    }
    if (c.destino === "campana") {
      return D.campanas.filter((x) => !x.archivada).map((x) => ({
        id: x.id, nombre: x.nombre, sub: i.coleccion.get(x.coleccion_id)?.nombre || "Sin colección", icon: "camera",
      }));
    }
    return D.opciones.filter((o) => o.tipo === c.opcionTipo && !o.archivada).map((o) => ({ id: o.id, nombre: o.nombre, icon: c.icon }));
  }

  function renderDestino() {
    const c = cat();
    const txt = DESTINO_TXT[c.destino === "opcion" ? c.opcionTipo : c.destino];
    const items = listItems();
    const needsCol = c.destino === "producto" || c.destino === "campana";
    const cols = c.coleccion ? coleccionItems() : [];
    // Publicidad y moldería se pueden cargar a uno o varios productos (en un envío, a uno solo).
    const multi = !!c.multi && !st.envio;
    if (multi && !st.sel) {
      const i = I();
      st.sel = new Set(st.multi?.length ? st.multi.map((id) => i.tanda.get(id)?.producto_id).filter(Boolean) : st.producto_id ? [st.producto_id] : []);
    }
    body.innerHTML = `
      ${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">${multi ? (c.coleccion ? "¿Qué producto/s o colección?" : "¿Qué producto/s?") : txt.titulo}</h3>
      ${multi && c.key === "produccion" ? `<p class="hint" style="margin:-4px 0 0">Elegí varios si el gasto sirve para más de uno (por ejemplo, una estampa compartida): se reparte según las unidades de cada uno.</p>` : ""}
      ${items.length + cols.length > 6 ? `<div class="search">${icon("search")}<input class="input" id="d-q" type="search" placeholder="Buscar" aria-label="Buscar" autocomplete="off"></div>` : ""}
      ${multi ? `<div class="hero-label" style="margin-bottom:-8px">Uno o varios productos</div>` : ""}
      <div class="card flush">
        <ul class="list" id="d-list">
          <li><button type="button" class="row add" id="d-add"><span class="ico-box">${icon("plus")}</span><span class="row-main">${txt.nuevo}</span></button></li>
          <li id="d-new" hidden><form class="inline-new" style="margin:0 12px 12px">
            <div class="field"><label for="d-name">${txt.label}</label><input id="d-name" class="input" placeholder="${esc(txt.ej)}" autocomplete="off" required></div>
            ${needsCol ? coleccionPicker() : ""}
            <div class="btn-row"><button type="button" class="btn secondary sm" id="d-cancel">Cancelar</button><button class="btn sm" id="d-save">Guardar y seguir</button></div>
          </form></li>
          ${items.map((it) => `<li data-name="${esc(it.nombre.toLowerCase())}"><button type="button" class="row" ${multi ? `data-toggle="${it.id}" aria-pressed="${st.sel.has(it.id)}"` : `data-pick="${it.id}"`}>
            ${it.foto ? `<span class="thumb"><img src="${fileUrl(it.foto, true)}" alt="" loading="lazy"></span>` : `<span class="ico-box">${icon(it.icon)}</span>`}
            <span class="row-main"><span class="row-title">${esc(it.nombre)}</span>${it.sub ? `<span class="row-sub">${esc(it.sub)}</span>` : ""}</span>
            ${multi ? `<span class="check" aria-hidden="true">${icon("check", "sm")}</span>` : icon("right", "chev")}</button></li>`).join("")}
        </ul>
      </div>
      ${!items.length ? `<p class="hint" style="margin:0">Todavía no hay nada cargado acá. Creá el primero arriba: queda guardado para las próximas cargas.</p>` : ""}
      ${c.coleccion ? `<div class="stack-sm">
        <div class="hero-label">O una colección entera</div>
        ${cols.length ? `<div class="card flush"><ul class="list">
          ${cols.map((it) => `<li data-name="${esc(it.nombre.toLowerCase())}"><button type="button" class="row" data-pickcol="${it.id}">
            <span class="ico-box">${icon("layers")}</span>
            <span class="row-main"><span class="row-title">${esc(it.nombre)}</span><span class="row-sub">${esc(it.sub)}</span></span>
            ${icon("right", "chev")}</button></li>`).join("")}
        </ul></div>
        <p class="hint" style="margin:0">El gasto se reparte entre todas las unidades de los productos de la colección.</p>`
        : `<p class="hint" style="margin:0">Todavía no hay colecciones. Se crean desde la pestaña Colecciones.</p>`}
      </div>` : ""}`;
    foot.parentElement.hidden = !multi;
    const seguir = () => {
      const n = st.sel.size;
      foot.innerHTML = `<button class="btn block" id="d-next" ${n ? "" : "disabled"}>${n > 1 ? `Seguir con ${n} productos` : n ? "Seguir con 1 producto" : "Elegí uno o varios productos"}</button>
        ${n > 1 ? `<p class="hint" style="margin:8px 0 0;text-align:center">Se reparte entre ellos según las unidades de cada uno.</p>` : ""}`;
      $("#d-next", foot).onclick = () => {
        const ids = [...st.sel];
        if (esConv()) return elegirProductosConv(ids);
        if (ids.length === 1) return pick(ids[0]);
        const i = I();
        const concepto = st.concepto;
        clearDestino();
        st.concepto = concepto;
        // Publicidad y producción: de cada producto, la tanda abierta más reciente (o la última, si están todas cerradas).
        // Moldería: es desarrollo, va a la primera tanda de cada producto.
        st.multi = ids.map((pid) => (c.key === "molderia" ? primeraTanda(i, pid)?.id : tandaActual(pid))).filter(Boolean);
        st.sel = new Set(ids);
        go("detalle");
      };
    };
    if (multi) {
      seguir();
      $$("[data-toggle]", body).forEach((b) => (b.onclick = () => {
        const id = Number(b.dataset.toggle);
        st.sel.has(id) ? st.sel.delete(id) : st.sel.add(id);
        b.setAttribute("aria-pressed", String(st.sel.has(id)));
        seguir();
      }));
    }

    const q = $("#d-q", body);
    if (q) q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      $$("li[data-name]", body).forEach((li) => (li.hidden = v && !li.dataset.name.includes(v)));
    };
    $$("[data-pickcol]", body).forEach((b) => (b.onclick = () => {
      if (esConv()) return elegirProductosConv(productosDeColeccion(Number(b.dataset.pickcol)));
      const concepto = st.concepto;
      clearDestino();
      st.concepto = concepto;
      st.coleccion_id = Number(b.dataset.pickcol);
      go("detalle");
    }));
    const form = $("#d-new form", body);
    $("#d-add", body).onclick = () => { $("#d-new", body).hidden = false; $("#d-add", body).parentElement.hidden = true; $("#d-name", body).value = q?.value || ""; $("#d-name", body).focus(); };
    $("#d-cancel", body).onclick = () => { $("#d-new", body).hidden = true; $("#d-add", body).parentElement.hidden = false; };
    if (needsCol) bindColeccionPicker(form);
    form.onsubmit = (e) => {
      e.preventDefault();
      const nombre = $("#d-name", body).value.trim();
      if (!nombre) return;
      busy($("#d-save", body), async () => {
        const colId = needsCol ? Number(form.dataset.col) || null : null;
        let row;
        if (c.destino === "muestra") row = await api("muestras", { method: "POST", body: { nombre } });
        else if (c.destino === "producto") row = await api("productos", { method: "POST", body: { nombre, coleccion_id: colId } });
        else if (c.destino === "campana") row = await api("campanas", { method: "POST", body: { nombre, coleccion_id: colId } });
        else row = await api("opciones", { method: "POST", body: { tipo: c.opcionTipo, nombre, orden: 50 } });
        await ctx.reload();
        toast(`“${nombre}” creado y guardado para la próxima`);
        if (multi) { st.sel.add(row.id); render(); return; }
        pick(row.id);
      });
    };
    $$("[data-pick]", body).forEach((b) => (b.onclick = () => pick(Number(b.dataset.pick))));
  }

  function coleccionItems() {
    const i = I();
    return i.D.colecciones.filter((x) => !x.archivada).map((x) => {
      const ts = i.D.tandas.filter((t) => tandaColeccionId(i, t) === x.id);
      const prods = new Set(ts.map((t) => t.producto_id)).size;
      const u = ts.reduce((s, t) => s + (unidades(t).n || 0), 0);
      return { id: x.id, nombre: x.nombre, sub: prods ? `${plural(prods, "producto")}${u ? ` · ${fmtInt(u)} u.` : ""}` : "Sin productos todavía" };
    });
  }

  function coleccionPicker() {
    const cols = I().D.colecciones.filter((x) => !x.archivada);
    return `<div class="field"><span class="label">Colección (opcional)</span>
      <div class="chips" data-colchips>
        <button type="button" class="chip" data-col="" aria-pressed="true">Sin colección</button>
        ${cols.map((x) => `<button type="button" class="chip" data-col="${x.id}" aria-pressed="false">${esc(x.nombre)}</button>`).join("")}
        <button type="button" class="chip add" data-newcol>${icon("plus", "sm")} Nueva</button>
      </div></div>`;
  }
  function bindColeccionPicker(form) {
    const set = (id) => {
      form.dataset.col = id || "";
      $$("[data-col]", form).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.col === String(id || ""))));
    };
    $$("[data-col]", form).forEach((b) => (b.onclick = () => set(b.dataset.col)));
    $("[data-newcol]", form).onclick = async () => {
      const r = await promptSheet({ title: "Nueva colección", label: "Nombre de la colección" });
      if (!r) return;
      const nombre = r.value;
      try {
        const row = await api("colecciones", { method: "POST", body: { nombre: nombre.trim() } });
        await ctx.reload();
        const chip = document.createElement("button");
        chip.type = "button"; chip.className = "chip"; chip.dataset.col = row.id; chip.textContent = row.nombre;
        chip.onclick = () => set(row.id);
        $("[data-newcol]", form).before(chip);
        set(row.id);
      } catch (err) { toast(err.message, true); }
    };
  }

  function pick(id) {
    const c = cat();
    const concepto = st.envio ? st.concepto : null; // en un envío el concepto ya se eligió antes
    clearDestino();
    st.concepto = concepto;
    if (c.destino === "muestra") st.muestra_id = id;
    else if (c.destino === "campana") st.campana_id = id;
    else if (c.destino === "opcion") st.opcion_id = id;
    else st.producto_id = id;

    if (c.tanda) {
      const abiertas = (I().tandasDeProducto.get(id) || []).filter((t) => !t.cerrada);
      if (abiertas.length === 1) { st.tanda_id = abiertas[0].id; return go("detalle"); }
      return go("tanda");
    }
    go("detalle");
  }

  /* ---------- Paso 2b: tanda (solo si hay más de una abierta) ---------- */
  function renderTanda() {
    const i = I();
    const ts = (i.tandasDeProducto.get(st.producto_id) || []).slice().sort((a, b) => b.id - a.id);
    const abiertas = ts.filter((t) => !t.cerrada);
    body.innerHTML = `${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">¿Qué tanda?</h3>
      ${!abiertas.length ? `<div class="note">${icon("lock", "sm")}<span>Todas las tandas de este producto están cerradas. Creá una nueva o reabrí una desde la ficha del producto.</span></div>` : ""}
      <div class="card flush"><ul class="list">
        ${abiertas.map((t) => `<li><button type="button" class="row" data-t="${t.id}">
          <span class="row-main"><span class="row-title">${esc(t.nombre)}</span><span class="row-sub">${t.cant_final ?? t.cant_estimada ?? "Sin"} unidades${t.cant_final == null && t.cant_estimada != null ? " (estimadas)" : ""}</span></span>${icon("right", "chev")}</button></li>`).join("")}
        <li><button type="button" class="row add" id="t-new"><span class="ico-box">${icon("plus")}</span><span class="row-main">Nueva tanda (Restock ${ts.length})</span></button></li>
      </ul></div>`;
    foot.parentElement.hidden = true;
    $$("[data-t]", body).forEach((b) => (b.onclick = () => { st.tanda_id = Number(b.dataset.t); go("detalle"); }));
    $("#t-new", body).onclick = (e) => busy(e.currentTarget, async () => {
      const p = i.producto.get(st.producto_id);
      const row = await api("tandas", { method: "POST", body: { producto_id: st.producto_id, nombre: `Restock ${ts.length}`, coleccion_id: p?.coleccion_id } });
      await ctx.reload();
      st.tanda_id = row.id;
      go("detalle");
    });
  }

  /* ---------- Paso 3: detalle y pago ---------- */
  function renderDetalle() {
    const c = cat();
    const i = I();
    const medios = i.D.opciones.filter((o) => o.tipo === "medio_pago" && !o.archivada);
    // En un envío el concepto ya se eligió en el paso anterior.
    const conceptos = c?.conceptos && !st.envio ? i.D.opciones.filter((o) => o.tipo === c.conceptos && !o.archivada) : [];
    const pago = editing ? pagoInfo(i, gasto) : null;
    const tanda = st.tanda_id ? i.tanda.get(st.tanda_id) : null;

    body.innerHTML = `
      ${crumbs()}
      ${!c ? `<div class="note warn">${icon("alert", "sm")}<span>Este gasto no tiene categoría. Tocá el importe para elegir una.</span></div>` : ""}
      ${editing && tanda?.cerrada ? `<div class="note warn">${icon("lock", "sm")}<span>La tanda “${esc(tanda.nombre)}” está cerrada. Reabrila desde la ficha del producto para corregir este gasto.</span></div>` : ""}
      ${conceptos.length ? `<div class="field"><span class="label">Concepto</span>
        <div class="chips" id="f-conc">
          ${conceptos.map((o) => `<button type="button" class="chip" data-conc="${esc(o.nombre)}" aria-pressed="${st.concepto === o.nombre}">${esc(o.nombre)}</button>`).join("")}
          <button type="button" class="chip add" id="f-conc-add">${icon("plus", "sm")} Agregar otro</button>
        </div></div>
      <div class="field" id="f-kg-wrap" ${esTela(st.concepto) ? "" : "hidden"}><label for="f-kg">Cantidad de tela (kg)</label>
        <input id="f-kg" class="input" inputmode="decimal" placeholder="Ej.: 12,5" value="${st.kg ? esc(fmtKg(st.kg, 3)) : ""}" autocomplete="off">
        <span class="hint" id="f-kg-hint">Con los kilos y las unidades que salgan se calcula el rendimiento de la tela.</span></div>
      <div class="field" id="f-stamp-wrap" ${esEstampa(st.concepto) ? "" : "hidden"}><span class="label">Tipo de estampa</span>
        <div class="chips" id="f-stamp">${STAMP_OPC.map(([k, t]) => `<button type="button" class="chip" data-stamp="${k}" aria-pressed="${stampBase() === k}">${t}</button>`).join("")}</div>
        <label class="row" id="f-propia-wrap" style="border:0;padding:0;min-height:44px" ${stampBase() === "serigrafia" ? "" : "hidden"}>
          <input type="checkbox" id="f-propia" ${st.estampa === "serigrafia_propia" ? "checked" : ""} style="width:22px;height:22px">
          <span class="row-main"><span class="row-title">Estampado por mí</span><span class="row-sub" style="white-space:normal">Tildalo si la estampaste vos. Cargá cada compra (tintas, shablón…) como un gasto aparte.</span></span></label></div>` : ""}
      ${st.categoria === "packaging" || (st.categoria === "produccion" && !st.envio) ? `<div class="field" id="f-cant-wrap" ${st.categoria === "packaging" || esAvioCarga() ? "" : "hidden"}>
        <label for="f-cant">${st.categoria === "packaging" ? "Cantidad de unidades compradas" : "¿Cuántos avíos compraste? (opcional)"}</label>
        <input id="f-cant" class="input" inputmode="numeric" placeholder="Ej.: ${st.categoria === "packaging" ? "5.000" : "100"}" value="${st.cantidad ? esc(st.cantidad.toLocaleString("es-AR")) : ""}">
        <span class="hint" id="f-unit"></span></div>` : ""}
      ${st.categoria === "produccion" && !st.envio ? `<div class="field" id="f-pp-wrap" ${esAvioCarga() ? "" : "hidden"}><span class="label">¿Cuántos lleva cada prenda? (opcional)</span>
        <div class="card flush"><ul class="list">${tandasSel().map((tid) => {
          const p = i.producto.get(i.tanda.get(tid)?.producto_id);
          const v = st.pesos.get(tid)?.por_prenda;
          return `<li><label class="row" for="pp-${tid}"><span class="row-main"><span class="row-title wrap">${esc(p?.nombre || "Producto")}</span></span>
            <input id="pp-${tid}" class="input num-in" data-pp="${tid}" inputmode="decimal" placeholder="—" value="${v ? esc(fmtKg(v, 2)) : ""}" aria-label="Avíos por prenda de ${esc(p?.nombre || "")}"></label></li>`;
        }).join("")}</ul></div>
        <span class="hint">Con lo que compraste y lo que lleva cada prenda, la simulación sabe desde cuántas unidades no hay desperdicio.${tandasSel().length > 1 ? " Entre varios productos se reparte según lo que usa cada uno." : ""}</span></div>` : ""}
      ${st.categoria === "suscripciones" ? `<div class="field"><span class="label">Período que cubre este pago</span>
        <div class="chips" id="f-cubre">${[[1, "1 mes"], [3, "3 meses"], [6, "6 meses"], [12, "1 año"]].map(([n, t]) =>
          `<button type="button" class="chip" data-cubre="${n}" aria-pressed="${(st.cubre_meses || 1) === n}">${t}</button>`).join("")}</div>
        <span class="hint">Se registra el pago completo hoy; en la simulación de gastos generales se reparte en el período.</span></div>` : ""}
      <div class="field"><label for="f-desc" id="f-desc-label">${esc(descTxt()[0])}</label>
        <input id="f-desc" class="input" value="${esc(st.descripcion || "")}" placeholder="${esc(descTxt()[1])}" autocomplete="off"></div>
      <div class="field"><label for="f-fecha">Fecha</label>
        <input id="f-fecha" class="input" type="date" value="${esc(st.fecha)}" max="2100-12-31"></div>
      <div class="field"><span class="label">Medio de pago</span>
        <div class="chips" id="f-medio">${medios.map((o) => `<button type="button" class="chip" data-medio="${esc(o.nombre)}" aria-pressed="${st.medio_pago === o.nombre}">${esc(o.nombre)}</button>`).join("")}</div></div>
      ${editing ? `<div class="note">${icon("wallet", "sm")}<span>Pagado ${money(pago.pagado, st.moneda)} de ${money(gasto.monto, st.moneda)}. Los pagos se registran desde el detalle del gasto.</span></div>` : `
      <div class="field"><span class="label">Estado del pago</span>
        <div class="seg" role="group" aria-label="Estado del pago">
          ${[["pagado", "Pagado"], ["parcial", "Pago parcial"], ["pendiente", "Pendiente"]].map(([k, t]) => `<button type="button" data-ep="${k}" aria-pressed="${st.estadoPago === k}">${t}</button>`).join("")}
        </div></div>
      <div class="field" id="f-parcial-wrap" ${st.estadoPago === "parcial" ? "" : "hidden"}>
        <label for="f-parcial">¿Cuánto pagaste ahora? (seña)</label>
        <input id="f-parcial" class="input" inputmode="decimal" placeholder="0" value="${esc(centsToInput(st.pagoParcial))}">
        <span class="hint" id="f-saldo">Costo acordado: ${money(st.monto, st.moneda)}</span></div>`}
      <details class="card" style="padding:0" ${st.proveedor || st.comprobante_id || st.estimado || st.en_cantidad ? "open" : ""}>
        <summary class="row" style="border:0">${icon("right", "chev")}<span class="row-main">Más datos <span class="muted">(opcional)</span></span></summary>
        <div class="stack" style="padding:0 16px 16px">
          <div class="field"><label for="f-prov">Proveedor</label><input id="f-prov" class="input" value="${esc(st.proveedor || "")}" autocomplete="off"></div>
          <div class="field"><span class="label">Comprobante</span>
            <div id="f-comp">${compHtml()}</div>
            <input type="file" id="f-file" accept="image/*,application/pdf" hidden></div>
          <label class="row" style="border:0;padding:0;min-height:44px"><input type="checkbox" id="f-est" ${st.estimado ? "checked" : ""} style="width:22px;height:22px">
            <span class="row-main"><span class="row-title">Importe estimado</span><span class="row-sub" style="white-space:normal">Marcalo si todavía no es el valor final.</span></span></label>
          ${st.categoria === "packaging" ? `<label class="row" style="border:0;padding:0;min-height:44px"><input type="checkbox" id="f-encant" ${st.en_cantidad ? "checked" : ""} style="width:22px;height:22px">
            <span class="row-main"><span class="row-title">Compra de insumos en cantidad</span><span class="row-sub" style="white-space:normal">No se suma como gasto mensual en la simulación.</span></span></label>` : ""}
        </div>
      </details>
      <div class="error-text" id="f-err" hidden></div>`;

    foot.innerHTML = `<button class="btn block" id="f-save" ${editing && tanda?.cerrada ? "disabled" : ""}>${icon("check")} ${editing ? "Guardar cambios" : "Guardar gasto"}</button>`;

    const bindChips = (sel, key, attr, conv = (x) => x, after) => $$(sel, body).forEach((b) => (b.onclick = () => {
      const v = conv(b.dataset[attr]);
      st[key] = st[key] === v && key === "concepto" ? null : v;
      $$(sel, body).forEach((x) => x.setAttribute("aria-pressed", String(conv(x.dataset[attr]) === st[key])));
      after?.();
    }));
    const showDesc = () => { const [l, ph] = descTxt(); $("#f-desc-label", body).textContent = l; $("#f-desc", body).placeholder = ph; };
    bindChips("[data-conc]", "concepto", "conc", undefined, () => {
      const wrap = $("#f-kg-wrap", body);
      if (wrap) wrap.hidden = !esTela(st.concepto);
      const sw = $("#f-stamp-wrap", body);
      if (sw) sw.hidden = !esEstampa(st.concepto);
      const cw = $("#f-cant-wrap", body);
      if (cw && st.categoria === "produccion") cw.hidden = !esAvioCarga();
      const pw = $("#f-pp-wrap", body);
      if (pw) pw.hidden = !esAvioCarga();
      showDesc();
    });
    // Estampa: bordado, serigrafía o DTF. La serigrafía puede ser de un taller o hecha por uno mismo.
    $$("[data-stamp]", body).forEach((b) => (b.onclick = () => {
      const k = b.dataset.stamp;
      st.estampa = stampBase() === k ? null : k === "serigrafia" && $("#f-propia", body).checked ? "serigrafia_propia" : k;
      $$("[data-stamp]", body).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.stamp === stampBase())));
      $("#f-propia-wrap", body).hidden = stampBase() !== "serigrafia";
      showDesc();
    }));
    const propia = $("#f-propia", body);
    if (propia) propia.onchange = () => {
      if (stampBase() === "serigrafia") st.estampa = propia.checked ? "serigrafia_propia" : "serigrafia";
      showDesc();
      if (propia.checked) $("#f-desc", body).focus();
    };
    const kg = $("#f-kg", body);
    const showKg = () => {
      const n = parseKg(kg.value);
      $("#f-kg-hint", body).textContent = n
        ? `Precio por kg: ${money(st.monto / n, st.moneda, true)}`
        : "Con los kilos y las unidades que salgan se calcula el rendimiento de la tela.";
    };
    if (kg) { kg.oninput = showKg; if (kg.value) showKg(); }
    bindChips("[data-medio]", "medio_pago", "medio");
    bindChips("[data-cubre]", "cubre_meses", "cubre", Number);

    const addConc = $("#f-conc-add", body);
    if (addConc) addConc.onclick = async () => {
      const r = await promptSheet({ title: "Nuevo concepto", label: "Nombre del concepto" });
      if (!r) return;
      const nombre = r.value;
      try {
        syncInputs();
        await api("opciones", { method: "POST", body: { tipo: c.conceptos, nombre: nombre.trim(), orden: 50 } });
        await ctx.reload();
        st.concepto = nombre.trim();
        render();
      } catch (err) { toast(err.message, true); }
    };

    $$("[data-ep]", body).forEach((b) => (b.onclick = () => {
      st.estadoPago = b.dataset.ep;
      $$("[data-ep]", body).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.ep === st.estadoPago)));
      $("#f-parcial-wrap", body).hidden = st.estadoPago !== "parcial";
      if (st.estadoPago === "parcial") $("#f-parcial", body).focus();
    }));
    const parcial = $("#f-parcial", body);
    if (parcial) parcial.oninput = () => {
      liveFormat(parcial);
      const p = parseAmount(parcial.value);
      $("#f-saldo", body).textContent = p && p < st.monto
        ? `Costo acordado ${money(st.monto, st.moneda)} · Pagado ${money(p, st.moneda)} · Queda pendiente ${money(st.monto - p, st.moneda)}`
        : `Costo acordado: ${money(st.monto, st.moneda)}`;
    };
    const cant = $("#f-cant", body);
    const showUnit = () => {
      const n = Number(cant.value.replace(/\D/g, ""));
      $("#f-unit", body).textContent = n > 0 ? `Precio por ${st.categoria === "packaging" ? "unidad" : "avío"}: ${money(st.monto / n, st.moneda, true)}` : "";
    };
    if (cant) { cant.oninput = () => { const n = cant.value.replace(/\D/g, ""); cant.value = n ? Number(n).toLocaleString("es-AR") : ""; showUnit(); }; showUnit(); }

    bindComprobante();
    $("#f-save", body.parentElement).onclick = (e) => save(e.currentTarget);
  }

  const stampBase = () => (st.estampa?.startsWith("serigrafia") ? "serigrafia" : st.estampa || null);
  // Con serigrafía hecha por uno mismo, cada compra se describe (tinta, shablón, emulsión…).
  function descTxt() {
    if (st.envio) return [`Descripción del ${ENVIO_TXT[st.envio].toLowerCase()}`, st.envio === "cadete" ? "Ej.: Cadete a la tejeduría" : "Ej.: Envío de la tela desde Buenos Aires"];
    if (esEstampa(st.concepto) && st.estampa === "serigrafia_propia") return ["¿Qué compraste para estampar?", "Ej.: Tinta plastisol blanca 1 kg"];
    return ["Descripción", DESC_EJ[st.categoria] || ""];
  }

  function compHtml() {
    if (st.comprobante_id) {
      return `<div class="btn-row"><a class="btn secondary sm" href="${fileUrl(st.comprobante_id)}" target="_blank" rel="noopener">${icon("file", "sm")} Ver comprobante</a>
        <button type="button" class="btn ghost sm" id="f-comp-x">Quitar</button></div>`;
    }
    return `<button type="button" class="btn secondary sm" id="f-comp-add">${icon("camera", "sm")} Sacar foto o elegir archivo</button>`;
  }
  function bindComprobante() {
    const file = $("#f-file", body);
    const add = $("#f-comp-add", body);
    if (add) add.onclick = () => file.click();
    const x = $("#f-comp-x", body);
    if (x) x.onclick = () => { st.comprobante_id = null; $("#f-comp", body).innerHTML = compHtml(); bindComprobante(); };
    file.onchange = async () => {
      const f = file.files[0];
      if (!f) return;
      $("#f-comp", body).innerHTML = `<span class="hint">Subiendo…</span>`;
      try { st.comprobante_id = (await uploadFile(f)).id; }
      catch (err) { toast(err.message, true); }
      $("#f-comp", body).innerHTML = compHtml();
      bindComprobante();
    };
  }

  function syncInputs() {
    const v = (id) => $(id, body)?.value;
    if ($("#f-desc", body)) st.descripcion = v("#f-desc").trim();
    if ($("#f-fecha", body)) st.fecha = v("#f-fecha") || today();
    if ($("#f-prov", body)) st.proveedor = v("#f-prov").trim();
    if ($("#f-cant", body)) st.cantidad = Number(v("#f-cant").replace(/\D/g, "")) || null;
    for (const x of $$("[data-pp]", body)) st.pesos.set(Number(x.dataset.pp), { ...(st.pesos.get(Number(x.dataset.pp)) || {}), por_prenda: parseKg(x.value) || null });
    if ($("#f-kg", body)) st.kg = parseKg(v("#f-kg"));
    if ($("#f-est", body)) st.estimado = $("#f-est", body).checked ? 1 : 0;
    if ($("#f-encant", body)) st.en_cantidad = $("#f-encant", body).checked ? 1 : 0;
    if ($("#f-parcial", body)) st.pagoParcial = parseAmount(v("#f-parcial"));
  }

  async function save(btn) {
    syncInputs();
    const err = $("#f-err", body);
    const fail = (msg) => { err.textContent = msg; err.hidden = false; err.scrollIntoView({ block: "center", behavior: "smooth" }); };
    err.hidden = true;
    if (!editing && st.estadoPago === "parcial" && !(st.pagoParcial > 0 && st.pagoParcial < st.monto)) {
      return fail("El pago parcial tiene que ser mayor a cero y menor al costo acordado.");
    }
    const payload = {
      fecha: st.fecha, monto: st.monto, moneda: st.moneda, categoria: st.categoria,
      muestra_id: st.muestra_id, producto_id: st.producto_id, tanda_id: st.tanda_id, campana_id: st.campana_id, opcion_id: st.opcion_id,
      coleccion_id: st.coleccion_id, kg: esTela(st.concepto) && !st.envio ? st.kg : null, estampa: esEstampa(st.concepto) && !st.envio ? st.estampa || null : null,
      envio: st.envio || null, concepto: st.concepto, descripcion: st.descripcion, medio_pago: st.medio_pago, proveedor: st.proveedor,
      comprobante_id: st.comprobante_id, cantidad: st.categoria === "packaging" || esAvioCarga() ? st.cantidad : null,
      publi_tipo: st.categoria === "publicidad" ? st.publi_tipo || "visibilidad" : null,
      cubre_meses: st.categoria === "suscripciones" ? st.cubre_meses || 1 : null, estimado: st.estimado, en_cantidad: st.en_cantidad,
    };
    // Si la tanda viene del producto, la guardamos también para que sea fácil filtrar.
    if (st.tanda_id && !st.producto_id) payload.producto_id = I().tanda.get(st.tanda_id)?.producto_id;
    if (!editing) {
      const pagado = st.estadoPago === "pagado" ? st.monto : st.estadoPago === "parcial" ? st.pagoParcial : 0;
      if (pagado) payload.pago_inicial = { monto: pagado, fecha: st.fecha, medio_pago: st.medio_pago };
    }
    await busy(btn, async () => {
      saved = editing
        ? await api(`gastos/${gasto.id}`, { method: "PATCH", body: payload })
        : await api("gastos", { method: "POST", body: payload });
      // Productos del gasto con sus datos: ventas (conversión) o avíos por prenda. Con uno solo, la fila solo guarda esos datos.
      const conv = esConv(), avio = esAvioCarga();
      const filas = tandasSel().map((t) => ({ tanda_id: t, ventas: conv ? st.pesos.get(t)?.ventas || 0 : null, por_prenda: avio ? st.pesos.get(t)?.por_prenda || null : null }));
      const conDatos = st.multi?.length || filas.some((f) => f.ventas != null || f.por_prenda != null);
      if (conDatos || I().filasDeGasto.has(saved.id)) await api(`gastos/${saved.id}/tandas`, { method: "PUT", body: { tandas: conDatos ? filas : [] } });
      const vinc = st.envio && st.vinc?.size ? [...st.vinc] : [];
      if (vinc.length || gasto?._vinc) await api(`gastos/${saved.id}/vinculos`, { method: "PUT", body: { ref_ids: vinc } });
      try { if (st.medio_pago) localStorage.setItem(LAST_MEDIO, st.medio_pago); } catch {}
      await ctx.reload();
    }).catch(() => null);
    if (!saved) return;
    if (editing) { toast("Cambios guardados"); sh.close(); return; }
    go("listo");
  }

  /* ---------- Listo ---------- */
  function renderListo() {
    const c = cat();
    body.innerHTML = `<div class="done">
      <div class="ok-circle">${icon("check")}</div>
      <h3 style="margin:8px 0 0;font-size:22px">Gasto guardado</h3>
      <div class="hero-value money" style="font-size:32px">${money(st.monto, st.moneda)}</div>
      <div class="muted">${esc([st.envio ? ENVIO[st.envio] : c?.nombre, st.categoria === "publicidad" && PUBLI[st.publi_tipo], destinoNombre(), st.concepto, esEstampa(st.concepto) && ESTAMPA[st.estampa]].filter(Boolean).join(" · "))}</div>
      <div class="muted small">${esc(fmtDate(st.fecha))}${st.estadoPago !== "pagado" ? ` · ${st.estadoPago === "parcial" ? "Pago parcial" : "Pendiente de pago"}` : ""}</div>
    </div>`;
    foot.innerHTML = `<div class="btn-row"><button class="btn secondary" id="l-ok">Listo</button><button class="btn" id="l-otro">${icon("plus")} Cargar otro</button></div>`;
    $("#l-ok", foot).onclick = () => sh.close();
    $("#l-otro", foot).onclick = () => {
      const keep = { fecha: st.fecha, medio_pago: st.medio_pago, moneda: st.moneda, envio: null, publi_tipo: null, pesos: new Map() };
      for (const k of Object.keys(st)) delete st[k];
      Object.assign(st, { monto: null, categoria: null, estadoPago: "pagado", estimado: 0, en_cantidad: 0, cubre_meses: 1, ...keep });
      saved = null;
      go("monto");
    };
  }

  // Si viene preseleccionado (por ejemplo, desde la ficha de una muestra), arranca en el importe igual.
  render();
  return sh;
}
