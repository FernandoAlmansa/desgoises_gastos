// Carga y edición de un gasto: Monto → categoría → selección → detalle → guardar.
import { CATEGORIAS, CAT, pagoInfo, tandaLabel, tandaColeccionId, unidades, esTela } from "./calc.js";
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
const DESC_EJ = {
  muestras: "Ej.: Segunda prueba de talle", produccion: "Ej.: Tela rústica negra 40 m", molderia: "Ej.: Moldes y progresión de talles",
  campanas: "Ej.: Estudio medio día", publicidad: "Ej.: Instagram, 7 días", suscripciones: "Ej.: Plan mensual",
  envios: "Ej.: Cambio de talle a Córdoba", equipamiento: "Ej.: Plancha industrial", comisiones: "Ej.: Comisión Mercado Pago",
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

  function clearDestino() {
    for (const k of ["muestra_id", "producto_id", "tanda_id", "campana_id", "opcion_id", "coleccion_id", "concepto", "cantidad", "kg"]) st[k] = null;
  }

  function crumbs() {
    const items = [];
    if (st.monto) items.push(["monto", money(st.monto, st.moneda)]);
    if (st.categoria) items.push(["monto", cat()?.corto || cat()?.nombre]);
    const dest = destinoNombre();
    if (dest) items.push(["destino", dest]);
    if (st.tanda_id && cat()?.tanda) {
      const t = I().tanda.get(st.tanda_id);
      if (t && (I().tandasDeProducto.get(t.producto_id) || []).length > 1) items.push(["tanda", t.nombre]);
    }
    return `<div class="crumbs">${items.map(([step, txt]) =>
      `<button type="button" class="crumb" data-go="${step}" aria-label="Cambiar ${esc(txt)}">${esc(txt)} ${icon("pencil")}</button>`).join("")}</div>`;
  }
  function destinoNombre() {
    const i = I();
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
          ${CATEGORIAS.map((c, n) => `<button type="button" class="cat-btn" data-cat="${c.key}" ${st.categoria === c.key ? 'aria-pressed="true"' : ""}>
            <span class="ico-box">${icon(c.icon)}</span><span>${esc(c.nombre)}</span></button>`).join("")}
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
      const keepDestino = st.categoria === b.dataset.cat && (destinoNombre() || !CAT[b.dataset.cat].destino);
      if (!keepDestino) { clearDestino(); st.categoria = b.dataset.cat; }
      if (keepDestino || !cat().destino) go("detalle");
      else go("destino");
    }));
  }

  /* ---------- Paso 2: selección (muestra, producto, campaña, servicio o insumo) ---------- */
  function listItems() {
    const i = I(), D = i.D, c = cat();
    if (c.destino === "muestra") {
      return D.muestras.filter((m) => !m.archivada).map((m) => {
        const n = (i.gastosDeMuestra.get(m.id) || []).length;
        const prod = m.producto_id ? i.producto.get(m.producto_id)?.nombre : null;
        return { id: m.id, nombre: m.nombre, sub: [prod && `Vinculada a ${prod}`, n ? plural(n, "gasto") : "Sin gastos"].filter(Boolean).join(" · "), icon: "scissors" };
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
    body.innerHTML = `
      ${crumbs()}
      <h3 class="h" style="margin:0;font-size:20px">${c.coleccion ? "¿Qué producto o colección?" : txt.titulo}</h3>
      ${items.length + cols.length > 6 ? `<div class="search">${icon("search")}<input class="input" id="d-q" type="search" placeholder="Buscar" aria-label="Buscar" autocomplete="off"></div>` : ""}
      ${c.coleccion ? `<div class="hero-label" style="margin-bottom:-8px">Un producto</div>` : ""}
      <div class="card flush">
        <ul class="list" id="d-list">
          <li><button type="button" class="row add" id="d-add"><span class="ico-box">${icon("plus")}</span><span class="row-main">${txt.nuevo}</span></button></li>
          <li id="d-new" hidden><form class="inline-new" style="margin:0 12px 12px">
            <div class="field"><label for="d-name">${txt.label}</label><input id="d-name" class="input" placeholder="${esc(txt.ej)}" autocomplete="off" required></div>
            ${needsCol ? coleccionPicker() : ""}
            <div class="btn-row"><button type="button" class="btn secondary sm" id="d-cancel">Cancelar</button><button class="btn sm" id="d-save">Guardar y seguir</button></div>
          </form></li>
          ${items.map((it) => `<li data-name="${esc(it.nombre.toLowerCase())}"><button type="button" class="row" data-pick="${it.id}">
            ${it.foto ? `<span class="thumb"><img src="${fileUrl(it.foto, true)}" alt="" loading="lazy"></span>` : `<span class="ico-box">${icon(it.icon)}</span>`}
            <span class="row-main"><span class="row-title">${esc(it.nombre)}</span>${it.sub ? `<span class="row-sub">${esc(it.sub)}</span>` : ""}</span>
            ${icon("right", "chev")}</button></li>`).join("")}
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
    foot.parentElement.hidden = true;

    const q = $("#d-q", body);
    if (q) q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      $$("li[data-name]", body).forEach((li) => (li.hidden = v && !li.dataset.name.includes(v)));
    };
    $$("[data-pickcol]", body).forEach((b) => (b.onclick = () => {
      clearDestino();
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
    clearDestino();
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
    const conceptos = c?.conceptos ? i.D.opciones.filter((o) => o.tipo === c.conceptos && !o.archivada) : [];
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
        <span class="hint" id="f-kg-hint">Con los kilos y las unidades que salgan se calcula el rendimiento de la tela.</span></div>` : ""}
      ${st.categoria === "packaging" ? `<div class="field"><label for="f-cant">Cantidad de unidades compradas</label>
        <input id="f-cant" class="input" inputmode="numeric" placeholder="Ej.: 5.000" value="${st.cantidad ? esc(st.cantidad.toLocaleString("es-AR")) : ""}">
        <span class="hint" id="f-unit"></span></div>` : ""}
      ${st.categoria === "suscripciones" ? `<div class="field"><span class="label">Período que cubre este pago</span>
        <div class="chips" id="f-cubre">${[[1, "1 mes"], [3, "3 meses"], [6, "6 meses"], [12, "1 año"]].map(([n, t]) =>
          `<button type="button" class="chip" data-cubre="${n}" aria-pressed="${(st.cubre_meses || 1) === n}">${t}</button>`).join("")}</div>
        <span class="hint">Se registra el pago completo hoy; en la simulación de gastos generales se reparte en el período.</span></div>` : ""}
      <div class="field"><label for="f-desc">Descripción</label>
        <input id="f-desc" class="input" value="${esc(st.descripcion || "")}" placeholder="${esc(DESC_EJ[st.categoria] || "")}" autocomplete="off"></div>
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
    bindChips("[data-conc]", "concepto", "conc", undefined, () => {
      const wrap = $("#f-kg-wrap", body);
      if (wrap) wrap.hidden = !esTela(st.concepto);
    });
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
      $("#f-unit", body).textContent = n > 0 ? `Precio por unidad: ${money(st.monto / n, st.moneda, true)}` : "";
    };
    if (cant) { cant.oninput = () => { const n = cant.value.replace(/\D/g, ""); cant.value = n ? Number(n).toLocaleString("es-AR") : ""; showUnit(); }; showUnit(); }

    bindComprobante();
    $("#f-save", body.parentElement).onclick = (e) => save(e.currentTarget);
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
      coleccion_id: st.coleccion_id, kg: esTela(st.concepto) ? st.kg : null, concepto: st.concepto, descripcion: st.descripcion, medio_pago: st.medio_pago, proveedor: st.proveedor,
      comprobante_id: st.comprobante_id, cantidad: st.categoria === "packaging" ? st.cantidad : null,
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
      <div class="muted">${esc([c?.nombre, destinoNombre(), st.concepto].filter(Boolean).join(" · "))}</div>
      <div class="muted small">${esc(fmtDate(st.fecha))}${st.estadoPago !== "pagado" ? ` · ${st.estadoPago === "parcial" ? "Pago parcial" : "Pendiente de pago"}` : ""}</div>
    </div>`;
    foot.innerHTML = `<div class="btn-row"><button class="btn secondary" id="l-ok">Listo</button><button class="btn" id="l-otro">${icon("plus")} Cargar otro</button></div>`;
    $("#l-ok", foot).onclick = () => sh.close();
    $("#l-otro", foot).onclick = () => {
      const keep = { fecha: st.fecha, medio_pago: st.medio_pago, moneda: st.moneda };
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
