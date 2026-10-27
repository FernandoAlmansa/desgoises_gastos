// Des Goises · Gastos y costos. Navegación y pantallas.
import {
  CATEGORIAS, CAT, M, index, pagoInfo, unidades, tandaCosts, productoResumen, coleccionCosts, campaignInfo,
  avisos, faltaAsignar, tandaLabel, destinoTexto, gastoTitulo, tandaColeccionId, generalesDelMes, simularCobertura,
  addMonths, publiColeccionInfo, esTela, esEstampa, ESTAMPA, estampaInfo, telasDeMuestra,
  inPeriod, conclusionPeriodo, ESTADO_PROD, ENVIO, compraNombre, moldeNombre, multiInfo,
} from "./calc.js";
import {
  icon, $, $$, esc, money, moneyM, fmtInt, parseAmount, liveFormat, centsToInput, today, thisMonth, monthName, fmtDate,
  fmtDateLong, plural, api, AuthError, toast, sheet, confirmSheet, promptSheet, busy, uploadFile, fileUrl, fmtKg, cropSquare,
} from "./ui.js";
import { openCarga } from "./carga.js";

const S = {
  data: null, I: null,
  mes: thisMonth(),       // período del Resumen
  verArchivados: false,
};
const main = $("#main");
const ctx = { I: () => S.I, reload, go: (h) => (location.hash = h) };

/* ================= Arranque ================= */

async function reload(keepScroll = true) {
  S.data = await api("data");
  S.I = index(S.data);
  render(keepScroll);
}

async function start() {
  try {
    await reload(false);
    showChrome(true);
    // Acceso directo "Añadir gasto" del ícono en la pantalla de inicio
    if (location.hash.includes("nuevo=1")) { history.replaceState(null, "", "#/resumen"); openCarga(ctx); }
  } catch (err) {
    if (err instanceof AuthError) return showLogin();
    main.innerHTML = `<div class="card empty">${icon("alert", "lg")}<div>${esc(err.message)}</div><button class="btn" onclick="location.reload()">Reintentar</button></div>`;
  }
}

function showChrome(on) {
  $("#topbar").hidden = !on;
  $("#tabbar").hidden = !on;
}

function showLogin(msg) {
  showChrome(false);
  main.innerHTML = `<div class="login"><form id="login">
    <img class="logo" src="/img/logo.png" alt="Des Goises" width="180" height="28">
    <h1 style="margin:0;text-align:center;font-size:22px">Gastos y costos</h1>
    <div class="field"><label for="clave">Clave</label>
      <input id="clave" class="input" type="password" autocomplete="current-password" required></div>
    <div class="error-text" id="l-err" ${msg ? "" : "hidden"}>${esc(msg || "")}</div>
    <button class="btn block">Entrar</button>
    <p class="hint" style="text-align:center;margin:0">Se pide una sola vez en cada teléfono.</p>
  </form></div>`;
  main.style.paddingBottom = "0";
  const f = $("#login");
  f.onsubmit = (e) => {
    e.preventDefault();
    busy(f.querySelector("button"), async () => {
      try {
        await api("login", { method: "POST", body: { clave: $("#clave").value } });
      } catch (err) {
        $("#l-err").textContent = err.message; $("#l-err").hidden = false;
        throw err;
      }
      main.style.paddingBottom = "";
      await start();
    }).catch(() => {});
  };
  setTimeout(() => $("#clave")?.focus(), 50);
}

/* ================= Router ================= */

function parseHash() {
  const h = location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { parts: (path || "resumen").split("/"), q: new URLSearchParams(qs || "") };
}

const ROOTS = { resumen: "Resumen", productos: "Productos", colecciones: "Colecciones", movimientos: "Movimientos", gestionar: "Gestionar" };

function render(keepScroll = false) {
  if (!S.I) return;
  const { parts, q } = parseHash();
  const [r, id, sub] = parts;
  const y = window.scrollY;
  const views = {
    resumen: () => vResumen(),
    productos: () => vProductos(),
    pendientes: () => vPendientes(q),
    producto: () => vProducto(Number(id), q),
    colecciones: () => vColecciones(),
    coleccion: () => vColeccion(Number(id)),
    campana: () => vCampana(Number(id)),
    muestra: () => vMuestra(Number(id)),
    opcion: () => vOpcion(Number(id)),
    movimientos: () => vMovimientos(q),
    gasto: () => vGasto(Number(id)),
    gestionar: () => (id ? vGestionarLista(id) : vGestionar()),
    simular: () => vSimular(),
  };
  const view = (views[r] || views.resumen)();
  if (!view) { location.hash = "#/resumen"; return; }

  const isRoot = !!ROOTS[r] && !id;
  $("#topbar").innerHTML = isRoot
    ? `<div class="title-wrap"><img class="logo" src="/img/logo.png" alt="Des Goises" width="116" height="18"><span class="sep"></span><h1>${esc(view.title)}</h1></div>
       ${r !== "gestionar" ? `<a class="icon-btn" href="#/gestionar" aria-label="Gestionar muestras, campañas y opciones">${icon("sliders")}</a>` : ""}`
    : `<button class="icon-btn" id="back" aria-label="Volver">${icon("left")}</button><h1>${esc(view.title)}</h1>${view.action || ""}`;
  $("#back")?.addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = view.parent || "#/resumen")));
  document.title = `${view.title} · Des Goises`;

  const tab = { resumen: "resumen", pendientes: "resumen", productos: "productos", producto: "productos", colecciones: "colecciones", coleccion: "colecciones",
    campana: "colecciones", movimientos: "movimientos", gasto: "movimientos" }[r];
  $$(".tab[data-tab]").forEach((t) => (t.dataset.tab === tab ? t.setAttribute("aria-current", "page") : t.removeAttribute("aria-current")));

  main.innerHTML = view.html;
  view.bind?.();
  $("#topbar [data-action]")?.addEventListener("click", view.onAction);
  window.scrollTo(0, keepScroll ? y : 0);
}

window.addEventListener("hashchange", () => render(false));
$("#addBtn").addEventListener("click", () => openCarga(ctx));

/* ================= Piezas comunes ================= */

const ESTADO_TANDA = {
  cerrado: ["ok", "Cerrado"], incompleto: ["warn", "Incompleto"], estimado: ["info", "Estimado"], al_dia: ["", "Abierto"],
};
const estadoBadge = (e) => `<span class="badge ${ESTADO_TANDA[e][0]}">${ESTADO_TANDA[e][1]}</span>`;
const PAGO_BADGE = { pagado: "", parcial: '<span class="badge warn">Pago parcial</span>', pendiente: '<span class="badge warn">Pendiente</span>' };
// Estado de la producción con punto de color y texto (gris, naranja o verde). Se calcula solo.
const estadoDot = (e) => `<span class="estado-dot ${e}">${ESTADO_PROD[e]}</span>`;

const muestraThumb = (m) => (m.foto_id ? `<span class="thumb"><img src="${fileUrl(m.foto_id, true)}" alt="" loading="lazy"></span>` : `<span class="ico-box">${icon("scissors")}</span>`);

function thumb(p, size = "") {
  return p?.foto_id
    ? `<span class="thumb ${size}"><img src="${fileUrl(p.foto_id, true)}" alt="" loading="lazy"></span>`
    : `<span class="thumb ${size}">${icon("shirt")}</span>`;
}

// Arriba lo que se anotó (descripción); abajo el concepto y a qué producto, colección o muestra va.
function gastoRow(g, { showCat = true } = {}) {
  const I = S.I;
  const p = pagoInfo(I, g);
  const c = CAT[g.categoria];
  const catTxt = showCat && (c?.corto || c?.nombre || "Sin categoría");
  const desc = (g.descripcion || "").trim();
  const title = desc || gastoTitulo(I, g);
  let conc = g.concepto && esEstampa(g.concepto) && ESTAMPA[g.estampa] ? `${g.concepto} (${ESTAMPA[g.estampa]})` : g.concepto;
  if (g.envio) conc = `${ENVIO[g.envio]} de ${g._parte ? (g._ref.descripcion || "").trim() || g.concepto : (g.concepto || "").toLowerCase()}`;
  const sub = (desc ? [conc || catTxt, destinoTexto(I, g)] : [catTxt])
    .concat(g.kg ? `${fmtKg(g.kg)} kg` : null, fmtDate(g.fecha)).filter(Boolean).join(" · ");
  // Parte de un envío repartido entre varias compras: se ve cuánto le toca acá y de cuánto era el envío.
  const parte = g._parte && g.monto !== I.gasto.get(g.id)?.monto ? `<span class="row-sub">de ${money(I.gasto.get(g.id).monto, g.moneda)}</span>` : "";
  return `<li><a class="row" href="#/gasto/${g.id}">
    <span class="row-main"><span class="row-title wrap">${esc(title)}</span><span class="row-sub wrap">${esc(sub)}</span></span>
    <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b>${parte}${faltaAsignar(g) ? '<span class="badge warn">Sin asignar</span>' : PAGO_BADGE[p.estado]}${g.estimado ? '<span class="badge info">Estimado</span>' : ""}</span>
  </a></li>`;
}
const gastoList = (gs, opts) => gs.length
  ? `<ul class="list">${gs.slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id).map((g) => gastoRow(g, opts)).join("")}</ul>`
  : `<div class="empty">Sin gastos todavía</div>`;

const tot = (gs) => M.sum(gs.map((g) => M.of(g.moneda, g.monto)));
const perUnit = (m, n, dec = true) => (n ? moneyM(M.scale(m, 1 / n), dec) : "—");
const unitsTxt = (u) => (u.n == null ? "Sin cantidad" : `${fmtInt(u.n)} u.${u.estimada ? " estimadas" : ""}`);

function fold({ title, total, extra = "", body, open = false }) {
  return `<details class="fold" ${open ? "open" : ""}><summary>${icon("right", "chev")}
    <span class="row-main"><span class="row-title">${title}</span></span>
    <span class="row-end"><b class="money">${total}</b>${extra ? `<span class="row-sub">${extra}</span>` : ""}</span></summary>
    <div class="fold-body">${body}</div></details>`;
}

// Fila de subtotal o total, con el valor por unidad si hay unidades.
const sumRow = (title, m, cls, n = null) => `<div class="row total-row ${cls}"><span class="row-main"><span class="row-title">${title}</span></span>
  <span class="row-end"><b class="money">${moneyM(m)}</b>${n ? `<span class="row-sub">${perUnit(m, n)} por unidad</span>` : ""}</span></div>`;
const gastoNombre = (g) => (g.descripcion || "").trim() || g.concepto || gastoTitulo(S.I, g);
const byFecha = (a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id;
const pctTxt = (x) => `${fmtKg(x, x < 10 ? 1 : 0)} %`;
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} y ${xs[xs.length - 1]}` : xs[0] || "");

async function patch(table, id, body, msg) {
  await api(`${table}/${id}`, { method: "PATCH", body });
  await reload();
  if (msg) toast(msg);
}

function periodNav(per, id = "per", withMode = true) {
  const label = per.length === 4 ? `Año ${per}` : monthName(per);
  return `<div class="card" style="padding:8px">
    <div class="period"><button class="icon-btn" data-${id}="-1" aria-label="Anterior">${icon("left")}</button>
      <span class="label" aria-live="polite">${label}</span>
      <button class="icon-btn" data-${id}="1" aria-label="Siguiente">${icon("right")}</button></div>
    ${withMode ? `<div class="seg" style="margin-top:8px"><button data-${id}-mode="mes" aria-pressed="${per.length !== 4}">Mes</button><button data-${id}-mode="anio" aria-pressed="${per.length === 4}">Año</button></div>` : ""}
  </div>`;
}
function bindPeriod(get, set, id = "per") {
  $$(`[data-${id}]`).forEach((b) => (b.onclick = () => {
    const p = get(), d = Number(b.dataset[id]);
    set(p.length === 4 ? String(Number(p) + d) : addMonths(p, d));
  }));
  $$(`[data-${id}-mode]`).forEach((b) => (b.onclick = () => {
    const p = get();
    set(b.dataset[`${id}Mode`] === "anio" ? p.slice(0, 4) : p.length === 4 ? (p === thisMonth().slice(0, 4) ? thisMonth() : `${p}-12`) : p);
  }));
}

/* ================= Resumen ================= */

function vResumen() {
  const I = S.I, D = S.data, per = S.mes;
  const C = conclusionPeriodo(I, per), B = C.balance;
  const gastos = D.gastos.filter((g) => inPeriod(g.fecha, per));
  const pagado = M.sum(D.pagos.filter((p) => inPeriod(p.fecha, per)).map((p) => M.of(I.gasto.get(p.gasto_id)?.moneda, p.monto)));
  const pendiente = M.sum(D.gastos.map((g) => M.of(g.moneda, pagoInfo(I, g).pendiente)));
  const MAX_MINI = 5;

  // Cada gasto en una fila fina: lo que anotaste en la descripción y el importe.
  const miniRows = (gs) => gs.slice().sort(byFecha).map((g) => `<li><a class="mini-row" href="#/gasto/${g.id}">
    <span class="mini-name">${esc(gastoNombre(g))}</span><span class="money">${money(g.monto, g.moneda)}</span></a></li>`).join("");
  // Cada muestra, producto o campaña con su flechita; al desplegar, sus gastos.
  const grupoFold = (gr) => `<details class="sub-fold"><summary>${icon("right", "chev")}
      <span class="sf-name">${esc(gr.nombre)}</span><span class="money">${moneyM(gr.total)}</span></summary>
    <ul class="mini-list">${miniRows(gr.gastos)}${gr.ruta ? `<li><a class="mini-row more" href="${gr.ruta}">Ver ficha</a></li>` : ""}</ul></details>`;
  const nGastos = (l) => new Set(l.gastos.map((g) => g.id)).size;
  const linea = (l) => {
    const n = nGastos(l);
    const todos = `#/movimientos?cat=${l.key === "no_producidas" ? "muestras" : l.key}&per=${per}`;
    return `<div class="bal-line"><div class="bal-head"><span class="row-main"><span class="row-title">${esc(l.nombre)}</span>
        <span class="row-sub">${n ? plural(n, "gasto") : "Sin gastos"}</span></span><b class="money">${moneyM(l.total)}</b></div>
      ${!n ? "" : l.grupos ? l.grupos.map(grupoFold).join("")
        : `<ul class="mini-list">${miniRows(l.gastos.slice().sort(byFecha).slice(0, MAX_MINI))}
          ${n > MAX_MINI ? `<li><a class="mini-row more" href="${todos}">Ver los ${n}</a></li>` : ""}</ul>`}</div>`;
  };
  // Muestras, moldería y otros gastos arrancan cerrados; la flechita hacia abajo, a la derecha, los despliega.
  const lineaPlegada = (l, cuantos) => {
    const n = nGastos(l);
    if (!n) return linea(l);
    return `<details class="bal-line bal-fold"><summary class="bal-head"><span class="row-main"><span class="row-title">${esc(l.nombre)}</span>
        <span class="row-sub">${cuantos(l.grupos.length)} · ${plural(n, "gasto")}</span></span><b class="money">${moneyM(l.total)}</b>${icon("down", "chev")}</summary>
      ${l.grupos.map(grupoFold).join("")}</details>`;
  };

  const activas = D.tandas.filter((t) => !t.cerrada && !I.producto.get(t.producto_id)?.archivado && (I.gastosDeTanda.get(t.id) || []).length);
  const al = avisos(I);
  const enPer = per.length === 4 ? "del año" : "del mes";

  return {
    title: "Resumen",
    html: `
      ${periodNav(per)}
      <section class="card" aria-label="Totales del período">
        <div class="hero-label">Gastos registrados · ${per.length === 4 ? per : monthName(per)}</div>
        <div class="hero-value money">${moneyM(C.total)}</div>
        <div class="hero-sub">${plural(gastos.length, "gasto")}${M.isZero(B.totalNoAsignados) ? "" : ` · incluye ${moneyM(B.totalNoAsignados)} no asignados`}</div>
        <div class="stats">
          <div class="stat"><span>Pagado en el período</span><b class="money">${moneyM(pagado)}</b></div>
          <a class="stat stat-link" href="#/pendientes" aria-label="Saldo pendiente total ${esc(moneyM(pendiente))}. Ver los pendientes"><span>Saldo pendiente (total)</span><b class="money">${moneyM(pendiente)}</b></a>
        </div>
      </section>

      ${al.length ? `<h2 class="section-label">Para completar</h2>
      <section class="card flush" aria-label="Avisos">
        <ul class="list" id="avisos">${al.map((a, n) => `<li ${n >= 6 ? "hidden" : ""}><a class="row alert-row" href="${a.ruta}">
          <span class="ico-box">${icon(a.tipo === "saldo" ? "wallet" : a.tipo === "duplicado" ? "file" : "alert", "sm")}</span>
          <span class="row-main"><span class="row-title">${esc(a.texto)}${a.monto ? ` <b class="money">${moneyM(a.monto)}</b>` : ""}</span></span>${icon("right", "chev")}</a></li>`).join("")}</ul>
          ${al.length > 6 ? `<button class="btn ghost block" id="more-av">Ver ${al.length - 6} más</button>` : ""}
      </section>` : ""}

      <h2 class="section-label">Producciones activas</h2>
      <section class="card flush">
        ${activas.length ? `<ul class="list">${activas.map((t) => {
          const p = I.producto.get(t.producto_id), tc = tandaCosts(I, t.id);
          return `<li><a class="row" href="#/producto/${p.id}?tanda=${t.id}">${thumb(p)}
            <span class="row-main"><span class="row-title">${esc(tandaLabel(I, t))}</span>
            <span class="row-sub">${ESTADO_PROD[tc.estadoProd]} · ${unitsTxt(tc.unidades)}</span></span>
            <span class="row-end">${estadoBadge(tc.estado)}</span></a></li>`;
        }).join("")}</ul>` : `<div class="empty">No hay producciones en curso.</div>`}
      </section>

      ${gastos.length ? `
      <h2 class="section-label">Balance</h2>
      <section class="card flush bal" aria-label="Balance del período">
        ${linea(B.produccion)}
        ${lineaPlegada(B.muestras, (n) => plural(n, "muestra"))}
        ${lineaPlegada(B.molderia, (n) => plural(n, "molde"))}
        ${sumRow("Gastos de producir ropa", B.producir, "subtotal")}
        ${linea(B.campanas)}${linea(B.publicidad)}
        ${sumRow("Gastos de producir y vender ropa", B.vender, "grand")}
      </section>

      <h2 class="section-label">Gastos no asignados</h2>
      <section class="card flush bal" aria-label="Gastos no asignados a la producción">
        ${B.noAsignados.length ? `${B.noAsignados.map((l) => (l.key === "otros" ? lineaPlegada(l, (n) => plural(n, "tipo")) : linea(l))).join("")}${sumRow("Total no asignado", B.totalNoAsignados, "grand")}`
          : `<div class="empty">No hubo gastos fuera de la producción.</div>`}
      </section>

      <h2 class="section-label">Conclusión ${enPer}</h2>
      ${conclusionHtml(C, per)}`
      : `<section class="card"><div class="empty">Sin gastos en este período.<button class="btn sm" data-add>${icon("plus", "sm")} Añadir gasto</button></div></section>`}
      <p class="hint" style="margin:0 4px">Esta app registra gastos y costos. Para conocer caja, ganancias o stock hace falta registrar ventas y saldos.</p>`,
    bind() {
      bindPeriod(() => S.mes, (p) => { S.mes = p; render(); });
      $("#more-av")?.addEventListener("click", (e) => { $$("#avisos li").forEach((li) => (li.hidden = false)); e.target.remove(); });
      $("[data-add]")?.addEventListener("click", () => openCarga(ctx));
    },
  };
}

const COL_ESTADO = {
  completa: ["ok", "Completa"], terminada: ["ok", "Terminada"], comenzada: ["info", "Comenzó"],
  en_curso: ["", "En curso"], terminada_antes: ["", "Ya terminada"],
};

// Conclusión escrita: arriba el cuadro de colecciones, abajo la explicación. Se arma sola con lo cargado.
function conclusionHtml(C, per) {
  const cuadro = C.colecciones.length ? `<section class="card flush" aria-label="Colecciones en producción"><ul class="list">${C.colecciones.map((c) => {
    const [cls, txt] = COL_ESTADO[c.estado];
    const head = `<span class="row-main"><span class="row-title">${esc(c.coleccion?.nombre || "Sin colección")}</span>
      <span class="row-sub money">${moneyM(c.gastado)} en producción</span></span><span class="badge ${cls}">${txt}</span>`;
    return `<li class="cat-group">${c.coleccion ? `<a class="row" href="#/coleccion/${c.coleccion.id}">${head}</a>` : `<div class="row">${head}</div>`}
      ${c.productos.length ? `<ul class="mini-list">${c.productos.map((p) => `<li><a class="mini-row" href="#/producto/${p.tanda.producto_id}?tanda=${p.tanda.id}">
        <span class="mini-name wrap">${esc(tandaLabel(S.I, p.tanda))}</span><span class="paso">${esc(p.estado)}${p.hecho ? `<span class="xs muted">${esc(p.hecho)}</span>` : ""}</span></a></li>`).join("")}</ul>` : ""}</li>`;
  }).join("")}</ul></section>` : "";
  const ps = conclusionTexto(C, per);
  return `${cuadro}<section class="card concl">${ps.map((t, i) => `<p class="${i ? "" : "lead"}">${t}</p>`).join("")}</section>
    <p class="hint" style="margin:0 4px">Se arma sola con lo que cargás: no hay que tocar nada. El paso de cada producto sale del último gasto de producción (tela → corte → estampa → confección → lavadero).</p>`;
}

function conclusionTexto(C, per) {
  const B = C.balance, P = [];
  const mes = per.length === 4 ? "año" : "mes";
  const pc = (x) => (x != null ? ` (${pctTxt(x)})` : "");
  const q = (s) => `“${esc(s)}”`;
  P.push(`En ${per.length === 4 ? per : monthName(per)} se gastaron <b class="money">${moneyM(C.total)}</b>${C.principal ? `, ${C.principal.pct >= 50 ? "la mayor parte" : "sobre todo"} en ${C.principal.nombre}${pc(C.principal.pct)}` : ""}.`);

  if (B.produccion.gastos.length) {
    const verbo = { completa: "producir completa", terminada: "terminar", comenzada: "comenzar", en_curso: "seguir produciendo", terminada_antes: "terminar de pagar" };
    const partes = C.colecciones.map((c) => {
      const abierta = !["completa", "terminada", "terminada_antes"].includes(c.estado) && c.productos.length;
      const pasos = abierta ? ` (${c.productos.map((p) => `${esc(p.producto?.nombre || "")}: ${esc(p.estado.toLowerCase())}`).join(", ")})` : "";
      return `${verbo[c.estado]} ${c.coleccion ? q(c.coleccion.nombre) : "productos sin colección"}${pasos}`;
    });
    P.push(`Se gastaron <b class="money">${moneyM(B.produccion.total)}</b> en producción${partes.length ? `, para ${lista(partes)}` : ""}.`);
  }
  if (C.muestras.n) {
    const np = C.muestras.noProducen;
    P.push(`Se ${C.muestras.n === 1 ? "hizo 1 muestra" : `hicieron ${C.muestras.n} muestras`} por <b class="money">${moneyM(C.muestras.total)}</b>${np
      ? `, y ya se sabe que ${np === C.muestras.n ? (np === 1 ? "no va a producirse" : "ninguna va a producirse") : np === 1 ? "una no va a producirse" : `${np} no van a producirse`}` : ""}.`);
  }
  for (const c of C.campanas) {
    P.push(`Se gastó <b class="money">${moneyM(c.total)}</b>${c.pctMes != null ? ` (${pctTxt(c.pctMes)} del ${mes})` : ""} en la campaña ${q(c.campana?.nombre || "")}${c.coleccion ? ` de ${q(c.coleccion.nombre)}` : ""}${
      c.pctColeccion != null ? `; la campaña es el ${pctTxt(c.pctColeccion)} del costo total de la colección` : ""}.`);
  }
  if (B.publicidad.gastos.length) P.push(`En publicidad se pusieron <b class="money">${moneyM(B.publicidad.total)}</b>${pc(C.rubros.find((r) => r.key === "publicidad")?.pct)}.`);
  if (B.noAsignados.length) {
    P.push(`Fuera de la producción se gastaron <b class="money">${moneyM(C.fuera.total)}</b>${pc(C.fuera.pct)}: ${lista(B.noAsignados.map((l) => `${esc(l.nombre.toLowerCase())} ${moneyM(l.total)}`))}.`);
    for (const u of C.unicos) {
      P.push(`Hubo un gasto único en equipamiento: ${q(gastoNombre(u.gasto))} por <b class="money">${money(u.gasto.monto, u.gasto.moneda)}</b>${u.pct != null
        ? u.pct >= 20 ? `. Solo eso ya es el ${pctTxt(u.pct)} de todo el ${mes} y hace que salga más caro` : `, el ${pctTxt(u.pct)} del ${mes}` : ""}.`);
    }
  }
  if (!M.isZero(C.saldosAnteriores)) P.push(`Además se pagaron <b class="money">${moneyM(C.saldosAnteriores)}</b> de saldos de gastos anteriores.`);
  return P;
}

/* ================= Productos ================= */

function vProductos() {
  const I = S.I, D = S.data;
  const all = D.productos.filter((p) => !!p.archivado === S.verArchivados);
  const nArch = D.productos.filter((p) => p.archivado).length;
  // Todos los productos, uno abajo del otro, separados por colección (las más nuevas primero; sin colección al final).
  const grupos = [...D.colecciones.map((c) => ({ nombre: c.nombre, ps: all.filter((p) => p.coleccion_id === c.id) })),
    { nombre: "Sin colección", ps: all.filter((p) => !I.coleccion.get(p.coleccion_id)) }].filter((g) => g.ps.length);

  const fila = (p) => {
    const r = productoResumen(I, p.id).actual;
    const u = r?.unidades || { n: null };
    const varias = (I.tandasDeProducto.get(p.id) || []).length > 1;
    const prodTxt = M.isZero(r?.lineas.produccion.total || {}) ? "Producción pendiente" : `Producción ${perUnit(r.lineas.produccion.total, u.n, false)}/u`;
    const metr = u.n
      ? `${prodTxt} · Directo ${perUnit(r.directo, u.n, false)}/u`
      : r && !M.isZero(r.directo) ? `Gastado ${moneyM(r.directo)} · falta cantidad` : "Sin gastos todavía";
    return `<li data-name="${esc(p.nombre.toLowerCase())}"><a class="row" href="#/producto/${p.id}">${thumb(p, "lg")}
      <span class="row-main"><span class="row-title">${esc(p.nombre)}</span>
        <span class="row-sub">${unitsTxt(u)}${varias ? ` · ${esc(r.tanda.nombre)}` : ""}</span>
        <span class="row-sub money wrap">${metr}</span></span>
      <span class="row-end">${r ? estadoBadge(r.estado) : ""}</span></a></li>`;
  };

  return {
    title: "Productos",
    html: `
      <div class="btn-row"><button class="btn" id="new-prod">${icon("plus")} Nuevo producto</button></div>
      ${all.length > 5 ? `<div class="search">${icon("search")}<input class="input" id="p-q" type="search" placeholder="Buscar producto" aria-label="Buscar producto"></div>` : ""}
      ${grupos.length ? grupos.map((g) => `<div class="prod-group" data-group><h2 class="section-label">${esc(g.nombre)}</h2>
        <section class="card flush"><ul class="list">${g.ps.map(fila).join("")}</ul></section></div>`).join("")
        : `<section class="card flush"><div class="empty">${S.verArchivados ? "No hay productos archivados." : "Todavía no hay productos. Creá uno acá o mientras cargás un gasto."}</div></section>`}
      ${nArch || S.verArchivados ? `<button class="btn ghost" id="arch">${S.verArchivados ? "Ver productos activos" : `Ver archivados (${nArch})`}</button>` : ""}`,
    bind() {
      $("#new-prod").onclick = () => nuevoProducto();
      $("#arch")?.addEventListener("click", () => { S.verArchivados = !S.verArchivados; render(); });
      const pq = $("#p-q");
      if (pq) pq.oninput = () => {
        const v = pq.value.trim().toLowerCase();
        $$("[data-group]").forEach((gr) => {
          $$("li[data-name]", gr).forEach((li) => (li.hidden = !li.dataset.name.includes(v)));
          gr.hidden = !$$("li[data-name]", gr).some((li) => !li.hidden);
        });
      };
    },
  };
}

function coleccionSelect(selected, id = "f-col") {
  const cols = S.data.colecciones.filter((c) => !c.archivada || c.id === selected);
  return `<div class="field"><label for="${id}">Colección</label><select id="${id}" class="select">
    <option value="">Sin colección</option>${cols.map((c) => `<option value="${c.id}" ${c.id === selected ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}
  </select></div>`;
}

async function nuevoProducto() {
  const r = await promptSheet({ title: "Nuevo producto", label: "Nombre del producto", ok: "Crear producto", extra: coleccionSelect(null) });
  if (!r) return;
  try {
    const row = await api("productos", { method: "POST", body: { nombre: r.value, coleccion_id: r.form.querySelector("#f-col").value || null } });
    await reload();
    location.hash = `#/producto/${row.id}`;
  } catch (err) { toast(err.message, true); }
}

function vProducto(id, q) {
  const I = S.I, D = S.data;
  const p = I.producto.get(id);
  if (!p) return null;
  const { tandas, actual } = productoResumen(I, id);
  const sel = tandas.find((c) => c.tanda.id === Number(q.get("tanda"))) || actual || tandas[0];
  const t = sel.tanda, u = sel.unidades, L = sel.lineas;
  const linked = I.muestrasDeProducto.get(id) || [];
  const hist = D.historial.filter((h) => h.tanda_id === t.id);
  const conceptosProd = D.opciones.filter((o) => o.tipo === "concepto_prod" && !o.archivada).map((o) => o.nombre);
  const extraConceptos = [...new Set(L.produccion.gastos.map((g) => g.concepto || "Sin concepto"))].filter((c) => !conceptosProd.includes(c));
  const cerrada = !!t.cerrada;

  const soloPrimera = (title) => fold({ title, total: "—", extra: "En Primera producción",
    body: `<p class="hint" style="margin:0">El desarrollo se cuenta una sola vez, en la primera tanda del producto, para no duplicarlo.</p>` });
  const lineFold = (title, m, gs, vacio) => fold({
    title, total: !gs.length && vacio ? vacio : moneyM(m), extra: u.n && !M.isZero(m) ? `${perUnit(m, u.n)} por unidad` : "",
    body: gs.length ? `<ul class="list">${gs.map((g) => gastoRow(g)).join("")}</ul>` : `<p class="hint" style="margin:0">Sin gastos asignados.</p>`,
  });
  const totalRow = (title, m, cls) => `<div class="row total-row ${cls}"><span class="row-main"><span class="row-title">${title}</span></span>
    <span class="row-end"><b class="money">${moneyM(m)}</b>${u.n ? `<span class="row-sub">${perUnit(m, u.n)} por unidad</span>` : ""}</span></div>`;
  const packRows = L.packaging.items.map((x) => packRow(x, u)).join("");
  const linkPackBtn = `<button class="row add" data-linkp><span class="ico-box">${icon("link")}</span><span class="row-main">Vincular packaging</span></button>`;
  const publiRows = [...L.publicidad.gastos.map((g) => gastoRow(g)), L.publicidad.coleccion ? publiColRow(L.publicidad.coleccion) : "",
    ...L.publicidad.multi.map(publiMultiRow)].join("");
  const unidadesRow = `<div class="row units-row"><span class="row-main"><span class="row-title">Unidades</span></span><span class="row-end"><b class="num">${unitsTxt(u)}</b></span></div>`;

  return {
    title: p.nombre,
    parent: "#/productos",
    action: `<button class="icon-btn" data-action aria-label="Editar producto">${icon("pencil")}</button>`,
    onAction: () => editarProducto(p),
    html: `
      ${photoHead(p.foto_id, `Foto de ${p.nombre}`, `
        <span class="kv"><span class="kv-l">Colección</span><b class="kv-v">${esc(I.coleccion.get(p.coleccion_id)?.nombre || "Sin colección")}${p.archivado ? " · Archivado" : ""}</b></span>
        <span class="kv"><span class="kv-l">Producción</span><b class="kv-v money">${moneyM(L.produccion.total)}</b>${u.n && !M.isZero(L.produccion.total) ? `<span class="kv-s money">${perUnit(L.produccion.total, u.n, false)} c/u</span>` : ""}</span>
        <span class="kv"><span class="kv-l">Directo</span><b class="kv-v money">${moneyM(sel.directo)}</b>${u.n && !M.isZero(sel.directo) ? `<span class="kv-s money">${perUnit(sel.directo, u.n, false)} c/u</span>` : ""}</span>
        ${estadoDot(sel.estadoProd)}`, "compact")}

      <div class="chips scroll" role="tablist" aria-label="Tandas">
        ${tandas.map((c) => `<a class="chip" role="tab" href="#/producto/${id}?tanda=${c.tanda.id}" aria-pressed="${c.tanda.id === t.id}" aria-selected="${c.tanda.id === t.id}">${c.tanda.cerrada ? icon("lock", "sm") : ""}${esc(c.tanda.nombre)}</a>`).join("")}
        <button class="chip add" id="new-tanda">${icon("plus", "sm")} Nueva tanda</button>
      </div>

      <section class="card stack">
        <div class="qty-row">
          <div class="field"><label for="q-est">Cantidad estimada</label>
            <input id="q-est" class="input money" inputmode="numeric" value="${t.cant_estimada ?? ""}" placeholder="—" ${cerrada ? "disabled" : ""}></div>
          <div class="field"><label for="q-fin">Cantidad final vendible</label>
            <input id="q-fin" class="input money" inputmode="numeric" value="${t.cant_final ?? ""}" placeholder="—" ${cerrada ? "disabled" : ""}></div>
        </div>
        ${t.cant_final != null && t.cant_estimada != null && t.cant_final !== t.cant_estimada ? `<p class="hint" style="margin:-8px 0 0">Se estimaron ${fmtInt(t.cant_estimada)} y quedaron ${fmtInt(t.cant_final)} (${t.cant_final > t.cant_estimada ? "+" : ""}${fmtInt(t.cant_final - t.cant_estimada)}).</p>` : ""}
        ${sel.avisos.map((a) => `<div class="note warn">${icon("alert", "sm")}<span>${esc(a)}</span></div>`).join("")}
      </section>

      <h2 class="section-label">Balance</h2>
      <section class="card flush balance">
        ${lineFold("Producción", L.produccion.total, L.produccion.gastos, "Pendiente")}
        ${L.muestras.aplica ? lineFold("Muestras", L.muestras.total, L.muestras.gastos) : soloPrimera("Muestras")}
        ${L.molderia.aplica ? fold({
          title: "Moldería todos los talles", total: moneyM(L.molderia.total),
          extra: u.n && !M.isZero(L.molderia.total) ? `${perUnit(L.molderia.total, u.n)} por unidad` : "",
          body: L.molderia.items.length ? `<ul class="list">${L.molderia.items.map((x) => moldeRow(x, u)).join("")}</ul>` : `<p class="hint" style="margin:0">Sin moldería cargada.</p>`,
        }) : soloPrimera("Moldería todos los talles")}
        ${fold({
          title: "Packaging", total: moneyM(L.packaging.total),
          extra: u.n && !M.isZero(L.packaging.total) ? `${perUnit(L.packaging.total, u.n)} por unidad` : "",
          body: `${packRows ? `<ul class="list">${packRows}</ul>` : `<p class="hint" style="margin:0 0 8px">Todavía no tiene packaging vinculado.</p>`}${linkPackBtn}`,
        })}
        ${totalRow("Total de fabricación y desarrollo", sel.fabricacion, "subtotal")}
        ${fold({
          title: "Campaña asignada", total: moneyM(L.campana.total),
          extra: u.n && !M.isZero(L.campana.total) ? `${perUnit(L.campana.total, u.n)} por unidad` : "",
          body: L.campana.campanas.length ? `<ul class="list">${L.campana.campanas.map((c) => `<li><a class="row" href="#/campana/${c.campana.id}">
              <span class="row-main"><span class="row-title">${esc(c.campana.nombre)}</span>
              <span class="row-sub">Total campaña ${moneyM(c.info.total)} · ${c.info.totalUnidades ? fmtInt(c.info.totalUnidades) + " u. participantes" : "faltan cantidades"}</span></span>
              <span class="row-end"><b class="money">${c.monto ? moneyM(c.monto) : "Pendiente"}</b>${c.info.estado === "estimado" ? '<span class="badge info">Estimado</span>' : c.info.estado === "falta_cantidad" ? '<span class="badge warn">Pendiente</span>' : ""}</span></a></li>`).join("")}</ul>`
            : `<p class="hint" style="margin:0">No participa en campañas. Se agrega desde la ficha de la campaña.</p>`,
        })}
        ${fold({
          title: "Publicidad asignada", total: moneyM(L.publicidad.total),
          extra: u.n && !M.isZero(L.publicidad.total) ? `${perUnit(L.publicidad.total, u.n)} por unidad` : "",
          body: publiRows ? `<ul class="list">${publiRows}</ul>` : `<p class="hint" style="margin:0">Sin gastos asignados.</p>`,
        })}
        ${totalRow("Total directo asignado", sel.directo, "grand")}
      </section>
      <p class="hint" style="margin:0 4px">${u.n ? `Por unidad sobre ${unitsTxt(u).replace(/\.$/, "")}. ` : ""}No incluye comisiones, envíos ni otros gastos generales de la marca.</p>

      <h2 class="section-label">Rendimiento de tela</h2>
      ${telaCard(sel.tela, u)}

      <h2 class="section-label">Conceptos de producción</h2>
      <section class="card flush"><ul class="list">
        <li>${unidadesRow}</li>
        ${[...conceptosProd, ...extraConceptos].map((c) => {
          const gs = L.produccion.gastos.filter((g) => (g.concepto || "Sin concepto") === c);
          const na = I.noAplica.has(`${t.id}|${c}`);
          const kg = esTela(c) ? gs.reduce((s, g) => s + (g.kg || 0), 0) : 0;
          let end;
          if (gs.length) end = `<b class="money">${moneyM(tot(gs))}</b>${u.n ? `<span class="row-sub">${perUnit(tot(gs), u.n)} por unidad</span>` : ""}${gs.some((g) => g.estimado) ? '<span class="badge info">Estimado</span>' : '<span class="badge ok">Confirmado</span>'}`;
          else if (na) end = `<span class="badge">No aplica</span>`;
          else end = `<span class="badge warn">Pendiente</span>`;
          const head = `<span class="row-main"><span class="row-title">${esc(c)}</span>${kg ? `<span class="row-sub">${fmtKg(kg)} kg</span>` : ""}</span><span class="row-end">${end}</span>`;
          // Tela y estampa se despliegan: cada tela, o cada método de estampa con sus gastos.
          if (gs.length && esTela(c)) return `<li>${conceptoFold(head, telaConceptoBody(sel.tela, u))}</li>`;
          if (gs.length && esEstampa(c)) return `<li>${conceptoFold(head, estampaBody(gs, u))}</li>`;
          return `<li><div class="row">${head}
            ${!gs.length && !cerrada ? `<button class="btn ghost sm" data-na="${esc(c)}" data-on="${na ? "" : "1"}">${na ? "Deshacer" : "No aplica"}</button>` : ""}</div></li>`;
        }).join("")}
      </ul></section>

      <div class="btn-row">
        <button class="btn" id="add-g" ${cerrada ? "disabled" : ""}>${icon("plus")} Cargar gasto</button>
        <button class="btn secondary" id="close-t">${icon(cerrada ? "unlock" : "lock")} ${cerrada ? "Reabrir tanda" : "Revisada y cerrada"}</button>
      </div>
      ${cerrada ? `<p class="hint" style="margin:0 4px">Tanda cerrada: sus cantidades y gastos no se modifican hasta reabrirla.</p>` : ""}

      <h2 class="section-label">Muestras vinculadas</h2>
      <section class="card flush">
        ${linked.length ? `<ul class="list">${linked.map((m) => `<li><a class="row" href="#/muestra/${m.id}">${muestraThumb(m)}
          <span class="row-main"><span class="row-title">${esc(m.nombre)}</span></span><span class="row-end"><b class="money">${moneyM(tot((I.gastosDeMuestra.get(m.id) || [])))}</b></span>${icon("right", "chev")}</a></li>`).join("")}</ul>` : ""}
        <button class="row add" id="link-m"><span class="ico-box">${icon("link")}</span><span class="row-main">Vincular una muestra</span></button>
      </section>
      <p class="hint" style="margin:0 4px">Vincular no duplica el gasto: es el mismo gasto visto desde la muestra y desde el producto.</p>

      <h2 class="section-label">Packaging de cada prenda</h2>
      <section class="card flush">
        ${packRows ? `<ul class="list">${packRows}</ul>` : ""}
        ${linkPackBtn}
      </section>
      <p class="hint" style="margin:0 4px">Se calcula con el precio por unidad de cada compra de packaging. La compra sigue figurando una sola vez en el Resumen.</p>

      ${hist.length ? `<details class="card" style="padding:0"><summary class="row" style="border:0">${icon("history")}<span class="row-main">Historial de cambios (${hist.length})</span>${icon("down", "chev")}</summary>
        <ul class="list" style="padding:0 16px 8px">${hist.map((h) => `<li class="row" style="padding:8px 0;min-height:0"><span class="row-main"><span class="row-sub">${esc(fmtDate(h.fecha.slice(0, 10)))}</span><span class="small" style="white-space:normal">${esc(histText(h))}</span></span></li>`).join("")}</ul></details>` : ""}

      <button class="btn ghost" id="edit-t">Editar tanda</button>`,
    bind() {
      bindPhoto("productos", id);
      const qty = (inp, col) => {
        inp.oninput = () => (inp.value = inp.value.replace(/\D/g, ""));
        inp.onchange = () => {
          const v = inp.value === "" ? null : Number(inp.value);
          if (v === 0) { toast("La cantidad no puede ser cero. Dejala vacía si no la sabés.", true); inp.value = t[col] ?? ""; return; }
          patch("tandas", t.id, { [col]: v }, "Cantidad guardada · costos recalculados").catch((e) => toast(e.message, true));
        };
      };
      qty($("#q-est"), "cant_estimada");
      qty($("#q-fin"), "cant_final");
      $$("[data-na]").forEach((b) => (b.onclick = () => busy(b, async () => {
        await api("tanda_conceptos", { method: "PUT", body: { tanda_id: t.id, concepto: b.dataset.na, estado: b.dataset.on ? "no_aplica" : null } });
        await reload();
      }).catch(() => {})));
      $("#add-g").onclick = () => openCarga(ctx, null, { categoria: "produccion", producto_id: id, tanda_id: t.id });
      $("#close-t").onclick = async () => {
        if (cerrada) return patch("tandas", t.id, { cerrada: 0 }, "Tanda reabierta").catch((e) => toast(e.message, true));
        const faltas = [
          ...sel.conceptosPendientes.map((c) => `${c}: pendiente`),
          ...(u.n == null ? ["Falta la cantidad"] : u.estimada ? ["La cantidad final no está confirmada"] : []),
          ...sel.lineas.campana.campanas.filter((c) => c.info.estado !== "final").map((c) => `Reparto de ${c.campana.nombre} sin confirmar`),
        ];
        const ok = await confirmSheet({
          title: "Cerrar tanda",
          text: faltas.length
            ? `<p style="margin-top:0">Antes de dar el cálculo por terminado, revisá:</p><ul>${faltas.map((f) => `<li>${esc(f)}</li>`).join("")}</ul><p>¿Cerrar igual? Se puede reabrir después.</p>`
            : "Está todo cargado. Al cerrarla queda marcada como revisada. Se puede reabrir después.",
          ok: "Cerrar tanda",
        });
        if (ok) patch("tandas", t.id, { cerrada: 1 }, "Tanda cerrada · producción finalizada").catch((e) => toast(e.message, true));
      };
      $("#new-tanda").onclick = async () => {
        const r = await promptSheet({ title: "Nueva tanda", label: "Nombre", value: `Restock ${tandas.length}`, ok: "Crear tanda", extra: coleccionSelect(p.coleccion_id) });
        if (!r) return;
        try {
          const row = await api("tandas", { method: "POST", body: { producto_id: id, nombre: r.value, coleccion_id: r.form.querySelector("#f-col").value || null } });
          await reload();
          location.hash = `#/producto/${id}?tanda=${row.id}`;
        } catch (err) { toast(err.message, true); }
      };
      $("#edit-t").onclick = () => editarTanda(t, tandas.length);
      $("#link-m").onclick = () => vincularMuestra(id);
      $$("[data-linkp]").forEach((b) => (b.onclick = () => vincularPackaging(id)));
      $$("[data-pack]").forEach((b) => (b.onclick = () => editarPackaging(L.packaging.items.find((x) => x.link.id === Number(b.dataset.pack)))));
    },
  };
}

const conceptoFold = (head, body) => `<details class="fold"><summary>${icon("right", "chev")}${head}</summary><div class="fold-body">${body}</div></details>`;

// Cada tela usada: kilos y plata, en total y por unidad, y qué parte de toda la tela es.
function telaConceptoBody(tela, u) {
  return `<ul class="list">${tela.porNombre.map((x) => {
    const pct = tela.kg && x.kg ? (x.kg / tela.kg) * 100 : null;
    return `<li><div class="row"><span class="row-main"><span class="row-title wrap">${esc(x.nombre)}</span>
      <span class="row-sub wrap">${x.kg ? `${fmtKg(x.kg)} kg` : "Sin kilos cargados"}${pct != null ? ` · ${pctTxt(pct)} de la tela` : ""}</span></span>
      <span class="row-end"><b class="money">${moneyM(x.total)}</b>${u.n ? `<span class="row-sub">${perUnit(x.total, u.n)} por u.</span>` : ""}${u.n && x.kg ? `<span class="row-sub">${consumoTxt(x.kg / u.n)} por u.</span>` : ""}</span></div></li>`;
  }).join("")}</ul>`;
}

// Métodos de estampa cargados (bordado, DTF, serigrafía ajena o por mí); cada uno se despliega con sus gastos.
function estampaBody(gs, u) {
  return estampaInfo(gs).map((x) => `<details class="fold"><summary>${icon("right", "chev")}
      <span class="row-main"><span class="row-title">${esc(x.nombre)}</span><span class="row-sub">${plural(x.gastos.length, "gasto")}</span></span>
      <span class="row-end"><b class="money">${moneyM(x.total)}</b>${u.n ? `<span class="row-sub">${perUnit(x.total, u.n)} por u.</span>` : ""}</span></summary>
    <div class="fold-body"><ul class="list">${x.gastos.slice().sort(byFecha).map((g) => `<li><a class="row" href="#/gasto/${g.id}">
      <span class="row-main"><span class="row-title wrap">${esc(gastoNombre(g))}</span><span class="row-sub">${esc(fmtDate(g.fecha))}</span></span>
      <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b>${u.n ? `<span class="row-sub">${money(g.monto / u.n, g.moneda, true)} por u.</span>` : ""}</span></a></li>`).join("")}</ul></div></details>`).join("");
}

// Foto cuadrada y más chica que el ancho de la pantalla, con los datos al costado.
// El botón de la cámara va sobre la foto, así queda lugar para los datos al costado.
function photoHead(fotoId, alt, meta, metaCls = "") {
  return `<div class="photo-head">
    <div class="sq-photo">${fotoId
      ? `<img src="${fileUrl(fotoId)}" alt="${esc(alt)}"><button class="photo-btn" id="photo" aria-label="Cambiar foto">${icon("camera", "sm")}</button>`
      : `<button class="sq-empty" id="photo">${icon("camera", "lg")}<span class="small">Agregar foto</span></button>`}
      <input type="file" id="photo-in" accept="image/*" hidden></div>
    <div class="photo-meta ${metaCls}">${meta}</div>
  </div>`;
}
function bindPhoto(table, id) {
  $("#photo").onclick = () => $("#photo-in").click();
  $("#photo-in").onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const foto = await cropSquare(f);
    if (!foto) return;
    await busy($("#photo"), async () => {
      const up = await uploadFile(foto, { photo: true });
      await patch(table, id, { foto_id: up.id }, "Foto guardada");
    }).catch(() => {});
  };
}

const fmtCant = (n) => fmtKg(n, 2);
const packNombre = (x) => [x.opcion?.nombre, (x.gasto.descripcion || "").trim()].filter(Boolean).join(" · ") || "Packaging";
function packRow(x, u) {
  return `<li><button class="row" data-pack="${x.link.id}"><span class="ico-box">${icon("package")}</span>
    <span class="row-main"><span class="row-title wrap">${esc(packNombre(x))}</span>
    <span class="row-sub wrap">${fmtCant(x.link.por_prenda)} por prenda · ${x.unit != null ? `${money(x.unit, x.gasto.moneda, true)} c/u` : "falta la cantidad comprada"}</span></span>
    <span class="row-end"><b class="money">${x.monto ? moneyM(x.monto) : "—"}</b>${x.unit != null ? `<span class="row-sub">${money(x.unit * x.link.por_prenda, x.gasto.moneda, true)} por unidad</span>` : '<span class="badge warn">Pendiente</span>'}</span></button></li>`;
}

// Una moldería en la ficha del producto: su total y cuánto le toca a cada unidad. Si sirve para varios productos,
// el total se divide entre las unidades de todos y este producto se lleva su parte.
function moldeRow(x, u) {
  const I = S.I, g = x.gasto;
  const tit = g.envio ? `${ENVIO[g.envio]} de ${moldeNombre(I, g)}` : moldeNombre(I, g);
  let sub, porU = null;
  if (x.info) {
    const n = x.info.parts.length;
    porU = x.info.totalUnidades && x.info.estado !== "falta_cantidad" ? g.monto / x.info.totalUnidades : null;
    sub = `Total ${money(g.monto, g.moneda)} · sirve para ${plural(n, "producto")}${x.info.totalUnidades ? ` (${fmtInt(x.info.totalUnidades)} u.)` : ""}`;
  } else {
    porU = u.n ? g.monto / u.n : null;
    sub = `Total ${money(g.monto, g.moneda)} · solo este producto`;
  }
  return `<li><a class="row" href="#/gasto/${g.id}">
    <span class="row-main"><span class="row-title wrap">${esc(tit)}</span><span class="row-sub wrap">${esc(sub)}</span></span>
    <span class="row-end"><b class="money">${x.monto ? moneyM(x.monto) : "Pendiente"}</b>${porU != null ? `<span class="row-sub">${money(porU, g.moneda, true)} por u.</span>` : ""}${x.info?.estado === "falta_cantidad" ? '<span class="badge warn">Falta cantidad</span>' : x.info?.estado === "estimado" ? '<span class="badge info">Estimado</span>' : ""}</span></a></li>`;
}

function publiMultiRow({ gasto: g, info, monto }) {
  const nombres = info.parts.map((p) => S.I.producto.get(p.tanda.producto_id)?.nombre).filter(Boolean).join(", ");
  return `<li><a class="row" href="#/gasto/${g.id}">
    <span class="row-main"><span class="row-title wrap">${esc((g.descripcion || "").trim() || "Publicidad")}</span>
    <span class="row-sub wrap">Total ${money(g.monto, g.moneda)} · repartido entre ${esc(nombres)}</span></span>
    <span class="row-end"><b class="money">${monto ? moneyM(monto) : "Pendiente"}</b>${info.estado === "estimado" ? '<span class="badge info">Estimado</span>' : info.estado === "falta_cantidad" ? '<span class="badge warn">Pendiente</span>' : ""}</span></a></li>`;
}

function publiColRow(pc) {
  const { coleccion, info, monto } = pc;
  return `<li><a class="row" href="#/coleccion/${coleccion.id}">
    <span class="row-main"><span class="row-title wrap">Publicidad de la colección ${esc(coleccion.nombre)}</span>
    <span class="row-sub wrap">Total ${moneyM(info.total)} · ${info.totalUnidades ? fmtInt(info.totalUnidades) + " u. en la colección" : "faltan cantidades"}</span></span>
    <span class="row-end"><b class="money">${monto ? moneyM(monto) : "Pendiente"}</b>${info.estado === "estimado" ? '<span class="badge info">Estimado</span>' : info.estado === "falta_cantidad" ? '<span class="badge warn">Pendiente</span>' : ""}</span></a></li>`;
}

const consumoTxt = (kg) => (kg < 1 ? `${fmtInt(Math.round(kg * 1000))} g` : `${fmtKg(kg)} kg`);

function telaLevels(x, u, pct) {
  const est = u.estimada ? " (estimado)" : "";
  return `<div class="levels" aria-label="Rendimiento de tela">
      <div class="level main"><span class="l-name">Rendimiento${est}</span><span class="l-val num">${x.unidadesPorKg ? `${fmtKg(x.unidadesPorKg)} u. por kg` : "—"}</span></div>
      <div class="level"><span class="l-name">Consumo por prenda${est}</span><span class="l-val num">${x.kgPorUnidad ? consumoTxt(x.kgPorUnidad) : "—"}</span></div>
      <div class="level"><span class="l-name">Tela comprada<span class="sub xs" style="display:block">${moneyM(x.total)} · ${moneyM(x.porKg, true)} por kg</span></span><span class="l-val num">${fmtKg(x.kg)} kg</span></div>
      ${pct != null ? `<div class="level"><span class="l-name">Del total de tela</span><span class="l-val num">${fmtKg(pct, 1)} %</span></div>` : ""}
      <div class="level"><span class="l-name">Unidades que salieron</span><span class="l-val num">${u.n == null ? "—" : unitsTxt(u)}</span></div>
    </div>`;
}

function telaCard(tela, u) {
  if (!tela.hayTela) {
    return `<section class="card"><p class="hint" style="margin:0">Cuando cargues la compra de tela (Producción → concepto Tela) con los kilos, acá vas a ver cuántas prendas salen por kilo.</p></section>`;
  }
  if (!tela.kg) {
    return `<section class="card"><div class="note warn" style="margin:0">${icon("alert", "sm")}<span>${tela.sinKg === 1 ? "La compra de tela no tiene" : `Las ${tela.sinKg} compras de tela no tienen`} los kilos cargados. Editala${tela.sinKg === 1 ? "" : "s"} y agregá los kg para ver el rendimiento.</span></div></section>`;
  }
  return `<section class="card stack">
    ${telaLevels(tela, u)}
    ${u.n == null ? `<p class="hint" style="margin:0">Cargá la cantidad de unidades para calcular el rendimiento.</p>` : ""}
    ${tela.sinKg ? `<p class="hint" style="margin:0">${plural(tela.sinKg, "compra")} de tela sin kilos no entra${tela.sinKg === 1 ? "" : "n"} en el cálculo.</p>` : ""}
  </section>
  <h3 class="sub-label">Telas utilizadas</h3>
  <section class="card flush">
    ${tela.telas.slice().sort((a, b) => b.kg - a.kg).map((x) => {
      const pct = (x.kg / tela.kg) * 100;
      return fold({
        title: esc(x.nombre), total: `${fmtKg(pct, 1)} %`, extra: `${fmtKg(x.kg)} kg`,
        body: telaLevels(x, u, pct),
      });
    }).join("")}
  </section>
  <p class="hint" style="margin:0 4px">Cada tela se separa por el nombre que le pusiste en la descripción al cargar el gasto.</p>`;
}

const CAMPOS = { monto: "Importe", cant_estimada: "Cantidad estimada", cant_final: "Cantidad final", estado: "Estado", cerrada: "Cerrada",
  categoria: "Categoría", tanda_id: "Tanda", concepto: "Concepto", descripcion: "Descripción", fecha: "Fecha", nombre: "Nombre", estimado: "Estimado",
  kg: "Kilos de tela", coleccion_id: "Colección", estampa: "Tipo de estampa" };
function histText(h) {
  let d; try { d = JSON.parse(h.detalle); } catch { return h.detalle; }
  const g = h.entidad === "gastos" ? S.I.gasto.get(h.entidad_id) : null;
  const pre = h.entidad === "gastos" ? `Gasto ${g ? gastoTitulo(S.I, g) : "#" + h.entidad_id}: ` : "";
  if (d.borrado) return `${pre}borrado (${money(d.borrado[1])})`;
  return pre + Object.entries(d).filter(([k]) => k !== "actualizado").map(([k, [a, b]]) => {
    const f = (v) => (v == null ? "vacío" : k === "monto" ? money(v) : k === "cerrada" || k === "estimado" ? (v ? "sí" : "no") : v);
    return `${CAMPOS[k] || k}: ${f(a)} → ${f(b)}`;
  }).join(" · ");
}

function editarProducto(p) {
  sheet({
    title: "Editar producto",
    render: ({ body, close }) => {
      body.innerHTML = `<form class="stack">
        <div class="field"><label for="e-n">Nombre</label><input id="e-n" class="input" value="${esc(p.nombre)}" required></div>
        ${coleccionSelect(p.coleccion_id)}
        <p class="hint" style="margin:-8px 0 0">Cambia la colección del producto. Cada tanda puede tener su propia colección desde “Editar tanda”.</p>
        <button class="btn block">Guardar</button>
        <div class="btn-row"><button type="button" class="btn secondary" id="e-arch">${icon("archive", "sm")} ${p.archivado ? "Desarchivar" : "Archivar"}</button>
        <button type="button" class="btn danger" id="e-del">${icon("trash", "sm")} Borrar</button></div>
      </form>`;
      const f = $("form", body);
      f.onsubmit = (e) => { e.preventDefault(); busy($("button", f), async () => { await patch("productos", p.id, { nombre: $("#e-n", body).value, coleccion_id: $("#f-col", body).value || null }, "Producto actualizado"); close(); }).catch(() => {}); };
      $("#e-arch", body).onclick = () => busy($("#e-arch", body), async () => { await patch("productos", p.id, { archivado: p.archivado ? 0 : 1 }, p.archivado ? "Producto activo" : "Producto archivado"); close(); }).catch(() => {});
      $("#e-del", body).onclick = async () => {
        if (!(await confirmSheet({ title: "Borrar producto", text: `Se borra “${esc(p.nombre)}” y sus tandas. Solo se puede si no tiene gastos.`, ok: "Borrar", danger: true }))) return;
        try { await api(`productos/${p.id}`, { method: "DELETE" }); close(); location.hash = "#/productos"; await reload(); toast("Producto borrado"); }
        catch (err) { toast(err.message, true); }
      };
    },
  });
}

function editarTanda(t, n) {
  sheet({
    title: "Editar tanda",
    render: ({ body, close }) => {
      body.innerHTML = `<form class="stack">
        <div class="field"><label for="e-n">Nombre</label><input id="e-n" class="input" value="${esc(t.nombre)}" required></div>
        ${coleccionSelect(tandaColeccionId(S.I, t))}
        <p class="hint" style="margin:-8px 0 0">La colección principal de la tanda define en qué colección se suman sus costos.</p>
        <button class="btn block">Guardar</button>
        ${n > 1 ? `<button type="button" class="btn danger" id="e-del">${icon("trash", "sm")} Borrar tanda</button>` : ""}
      </form>`;
      const f = $("form", body);
      f.onsubmit = (e) => { e.preventDefault(); busy($("button", f), async () => { await patch("tandas", t.id, { nombre: $("#e-n", body).value, coleccion_id: $("#f-col", body).value || null }, "Tanda actualizada"); close(); }).catch(() => {}); };
      $("#e-del", body)?.addEventListener("click", async () => {
        if (!(await confirmSheet({ title: "Borrar tanda", text: "Solo se puede si no tiene gastos.", ok: "Borrar", danger: true }))) return;
        try { await api(`tandas/${t.id}`, { method: "DELETE" }); close(); location.hash = `#/producto/${t.producto_id}`; await reload(); toast("Tanda borrada"); }
        catch (err) { toast(err.message, true); }
      });
    },
  });
}

function vincularMuestra(productoId) {
  const libres = S.data.muestras.filter((m) => !m.archivada && m.producto_id !== productoId);
  sheet({
    title: "Vincular muestra",
    render: ({ body, close }) => {
      body.innerHTML = `${libres.length ? `<div class="card flush"><ul class="list">${libres.map((m) => `<li><button class="row" data-m="${m.id}">
        ${muestraThumb(m)}<span class="row-main"><span class="row-title">${esc(m.nombre)}</span>
        <span class="row-sub">${m.producto_id ? `Hoy vinculada a ${esc(S.I.producto.get(m.producto_id)?.nombre)}` : "Sin vincular"} · ${moneyM(tot(S.I.gastosDeMuestra.get(m.id) || []))}</span></span></button></li>`).join("")}</ul></div>`
        : `<div class="empty">No hay muestras para vincular.</div>`}`;
      $$("[data-m]", body).forEach((b) => (b.onclick = () => busy(b, async () => { await patch("muestras", Number(b.dataset.m), { producto_id: productoId, no_produce: 0 }, "Muestra vinculada"); close(); }).catch(() => {})));
    },
  });
}

// Elegís el insumo (bolsa, sticker…), y si hay varias compras, cuál. El precio por unidad sale de esa compra.
function vincularPackaging(productoId) {
  const I = S.I;
  const yaVinculados = new Set((I.packagingDeProducto.get(productoId) || []).map((l) => l.gasto_id));
  const opciones = S.data.opciones.filter((o) => o.tipo === "packaging" && !o.archivada);
  const comprasDe = (o) => (I.gastosDeOpcion.get(o.id) || []).filter((g) => !yaVinculados.has(g.id))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  const precio = (g) => (g.cantidad ? `${fmtInt(g.cantidad)} u. · ${money(g.monto / g.cantidad, g.moneda, true)} c/u` : "Sin cantidad cargada");
  sheet({
    title: "Vincular packaging",
    render: ({ body, close, setTitle }) => {
      const elegirInsumo = () => {
        setTitle("Vincular packaging");
        body.innerHTML = opciones.length ? `<div class="card flush"><ul class="list">${opciones.map((o) => {
          const n = comprasDe(o).length;
          return `<li><button class="row" data-o="${o.id}"><span class="ico-box">${icon("package")}</span>
            <span class="row-main"><span class="row-title">${esc(o.nombre)}</span><span class="row-sub">${n ? plural(n, "compra") : "Sin compras para vincular"}</span></span>${icon("right", "chev")}</button></li>`;
        }).join("")}</ul></div>` : `<div class="empty">No hay insumos de packaging.</div>`;
        $$("[data-o]", body).forEach((b) => (b.onclick = () => {
          const o = I.opcion.get(Number(b.dataset.o));
          const compras = comprasDe(o);
          if (!compras.length) return sinCompras(o);
          if (compras.length === 1) return confirmar(compras[0], o);
          elegirCompra(o, compras);
        }));
      };
      const sinCompras = (o) => {
        setTitle(o.nombre);
        body.innerHTML = `<div class="stack"><div class="note">${icon("package", "sm")}<span>Todavía no hay una compra de ${esc(o.nombre)} para vincular. Cargala con la cantidad de unidades y después vinculala acá.</span></div>
          <button class="btn block" id="pk-cargar">${icon("plus")} Cargar compra de ${esc(o.nombre)}</button>
          <button class="btn ghost block" id="pk-back">Volver</button></div>`;
        $("#pk-cargar", body).onclick = () => { close(); openCarga(ctx, null, { categoria: "packaging", opcion_id: o.id }); };
        $("#pk-back", body).onclick = elegirInsumo;
      };
      const elegirCompra = (o, compras) => {
        setTitle(`¿Qué ${o.nombre.toLowerCase()}?`);
        body.innerHTML = `<div class="card flush"><ul class="list">${compras.map((g) => `<li><button class="row" data-g="${g.id}">
          <span class="row-main"><span class="row-title wrap">${esc((g.descripcion || "").trim() || fmtDateLong(g.fecha))}</span><span class="row-sub">${esc(precio(g))}</span></span>
          <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b></span></button></li>`).join("")}</ul></div>
          <button class="btn ghost block" id="pk-back">Volver</button>`;
        $$("[data-g]", body).forEach((b) => (b.onclick = () => confirmar(I.gasto.get(Number(b.dataset.g)), o)));
        $("#pk-back", body).onclick = elegirInsumo;
      };
      const confirmar = (g, o) => {
        setTitle(o.nombre);
        body.innerHTML = `<form class="stack">
          <div class="note">${icon("package", "sm")}<span>${esc((g.descripcion || "").trim() || o.nombre)} · ${esc(precio(g))}</span></div>
          ${g.cantidad ? "" : `<div class="field"><label for="pk-cant">¿Cuántas unidades trajo esa compra?</label>
            <input id="pk-cant" class="input" inputmode="numeric" placeholder="Ej.: 500" required></div>`}
          <div class="field"><label for="pk-pp">Cuántas lleva cada prenda</label>
            <input id="pk-pp" class="input" inputmode="decimal" value="1" required></div>
          <button class="btn block">${icon("link")} Vincular</button>
          <button type="button" class="btn ghost block" id="pk-back">Volver</button></form>`;
        const cant = $("#pk-cant", body);
        if (cant) cant.oninput = () => { const n = cant.value.replace(/\D/g, ""); cant.value = n ? Number(n).toLocaleString("es-AR") : ""; };
        $("#pk-back", body).onclick = elegirInsumo;
        const f = $("form", body);
        f.onsubmit = (e) => {
          e.preventDefault();
          const pp = Number($("#pk-pp", body).value.replace(",", "."));
          if (!(pp > 0)) return toast("Poné cuántas lleva cada prenda (por ejemplo, 1)", true);
          busy($("button", f), async () => {
            if (cant) await api(`gastos/${g.id}`, { method: "PATCH", body: { cantidad: Number(cant.value.replace(/\D/g, "")) } });
            await api("producto_packaging", { method: "POST", body: { producto_id: productoId, gasto_id: g.id, por_prenda: pp } });
            await reload();
            toast("Packaging vinculado");
            close();
          }).catch(() => {});
        };
      };
      elegirInsumo();
    },
  });
}

function editarPackaging(x) {
  if (!x) return;
  sheet({
    title: packNombre(x),
    render: ({ body, close }) => {
      body.innerHTML = `<form class="stack">
        <div class="note">${icon("package", "sm")}<span>${x.unit != null ? `${money(x.unit, x.gasto.moneda, true)} c/u (${money(x.gasto.monto, x.gasto.moneda)} ÷ ${fmtInt(x.gasto.cantidad)} u.)` : "La compra no tiene la cantidad de unidades. Editala para calcular el precio."}</span></div>
        <div class="field"><label for="pk-pp">Cuántas lleva cada prenda</label>
          <input id="pk-pp" class="input" inputmode="decimal" value="${esc(fmtCant(x.link.por_prenda))}" required></div>
        <button class="btn block">Guardar</button>
        <div class="btn-row"><a class="btn secondary" href="#/gasto/${x.gasto.id}" id="pk-ver">Ver la compra</a>
          <button type="button" class="btn danger" id="pk-del">${icon("trash", "sm")} Desvincular</button></div>
      </form>`;
      const f = $("form", body);
      f.onsubmit = (e) => {
        e.preventDefault();
        const pp = Number($("#pk-pp", body).value.replace(",", "."));
        if (!(pp > 0)) return toast("Poné cuántas lleva cada prenda (por ejemplo, 1)", true);
        busy($("button", f), async () => { await patch("producto_packaging", x.link.id, { por_prenda: pp }, "Guardado"); close(); }).catch(() => {});
      };
      $("#pk-ver", body).onclick = () => close();
      $("#pk-del", body).onclick = () => busy($("#pk-del", body), async () => {
        await api(`producto_packaging/${x.link.id}`, { method: "DELETE" });
        await reload();
        toast("Packaging desvinculado");
        close();
      }).catch(() => {});
    },
  });
}

/* ================= Colecciones ================= */

function vColecciones() {
  const I = S.I, D = S.data;
  const cols = D.colecciones.filter((c) => !!c.archivada === S.verArchivados);
  const nArch = D.colecciones.filter((c) => c.archivada).length;
  return {
    title: "Colecciones",
    html: `
      <div class="btn-row"><button class="btn" id="new-col">${icon("plus")} Nueva colección</button></div>
      ${cols.length ? `<div class="col-grid">${cols.map((c) => {
          const cc = coleccionCosts(I, c.id);
          return `<a class="col-tile" href="#/coleccion/${c.id}">
            ${c.foto_id ? `<img src="${fileUrl(c.foto_id)}" alt="" loading="lazy">` : `<span class="col-ph">${icon("layers", "lg")}</span>`}
            <span class="col-info">
              <span class="col-name">${esc(c.nombre)}</span>
              <span class="col-sub">${plural(cc.productos.length, "producto")} · ${plural(cc.campanas.length, "campaña")}</span>
              <span class="col-total"><b class="money">${moneyM(cc.total)}</b> directo</span>
            </span></a>`;
        }).join("")}</div>` : `<section class="card"><div class="empty">${S.verArchivados ? "No hay colecciones archivadas." : "Todavía no hay colecciones."}</div></section>`}
      ${nArch || S.verArchivados ? `<button class="btn ghost" id="arch">${S.verArchivados ? "Ver colecciones activas" : `Ver archivadas (${nArch})`}</button>` : ""}
      <h2 class="section-label">Campañas de contenido</h2>
      <section class="card flush">${campanasList(D.campanas.filter((c) => !c.archivada))}
        <button class="row add" id="new-camp"><span class="ico-box">${icon("plus")}</span><span class="row-main">Nueva campaña</span></button></section>`,
    bind() {
      $("#new-col").onclick = async () => {
        const r = await promptSheet({ title: "Nueva colección", label: "Nombre de la colección", ok: "Crear" });
        if (!r) return;
        try { const row = await api("colecciones", { method: "POST", body: { nombre: r.value } }); await reload(); location.hash = `#/coleccion/${row.id}`; }
        catch (err) { toast(err.message, true); }
      };
      $("#arch")?.addEventListener("click", () => { S.verArchivados = !S.verArchivados; render(); });
      $("#new-camp").onclick = () => nuevaCampana();
    },
  };
}

function campanasList(cs) {
  if (!cs.length) return "";
  return `<ul class="list">${cs.map((c) => {
    const info = campaignInfo(S.I, c.id);
    const badge = { sin_productos: '<span class="badge warn">Sin productos</span>', falta_cantidad: '<span class="badge warn">Reparto pendiente</span>', estimado: '<span class="badge info">Estimado</span>', final: '<span class="badge ok">Final</span>' }[info.estado];
    return `<li><a class="row" href="#/campana/${c.id}"><span class="ico-box">${icon("camera")}</span>
      <span class="row-main"><span class="row-title">${esc(c.nombre)}</span><span class="row-sub">${esc(S.I.coleccion.get(c.coleccion_id)?.nombre || "Sin colección")} · ${plural(info.parts.length, "producto")}</span></span>
      <span class="row-end"><b class="money">${moneyM(info.total)}</b>${badge}</span></a></li>`;
  }).join("")}</ul>`;
}

async function nuevaCampana(colId = null) {
  const r = await promptSheet({ title: "Nueva campaña", label: "Nombre de la campaña", ok: "Crear", extra: coleccionSelect(colId) });
  if (!r) return;
  try {
    const row = await api("campanas", { method: "POST", body: { nombre: r.value, coleccion_id: r.form.querySelector("#f-col").value || null } });
    await reload();
    location.hash = `#/campana/${row.id}`;
  } catch (err) { toast(err.message, true); }
}

function vColeccion(id) {
  const I = S.I;
  const c = I.coleccion.get(id);
  if (!c) return null;
  const cc = coleccionCosts(I, id);
  const L = cc.lineas;
  const pc = publiColeccionInfo(I, id);
  const pcTxt = {
    sin_productos: ["warn", "Sin productos", "La colección todavía no tiene productos entre los que repartir."],
    falta_cantidad: ["warn", "Reparto pendiente", `Falta la cantidad de: ${pc.faltan.map((p) => tandaLabel(I, p.tanda)).join(", ")}.`],
    estimado: ["info", "Reparto estimado", "Usa cantidades o importes estimados. Se recalcula solo cuando cargues los finales."],
    final: ["ok", "Reparto final", "Con cantidades finales."],
  }[pc.estado];
  // Cada línea arranca cerrada; adentro, cada producto, muestra, molde o campaña también se despliega con su detalle.
  const itemRow = (x) => {
    const g = x.gasto, real = I.gasto.get(g.id);
    const parte = real && M.get(x.monto, g.moneda) !== real.monto ? `<span class="row-sub">de ${money(real.monto, g.moneda)}</span>` : "";
    const sub = [g.envio ? `${ENVIO[g.envio]} de ${g._parte ? (g._ref.descripcion || "").trim() || g.concepto : (g.concepto || "").toLowerCase()}` : g.concepto, fmtDate(g.fecha)].filter(Boolean).join(" · ");
    return `<li><a class="row" href="#/gasto/${g.id}"><span class="row-main"><span class="row-title wrap">${esc(gastoNombre(g))}</span><span class="row-sub wrap">${esc(sub)}</span></span>
      <span class="row-end"><b class="money">${moneyM(x.monto)}</b>${parte}</span></a></li>`;
  };
  const sinGastos = `<p class="hint" style="margin:0">Sin gastos.</p>`;
  const colFold = (title, l, cuantos) => fold({
    title: `${title} <span class="muted fold-n">(${cuantos})</span>`, total: moneyM(l.total),
    body: !l.items.length ? sinGastos : l.grupos
      ? l.grupos.map((gr) => fold({ title: esc(gr.nombre), total: moneyM(gr.total),
          body: `<ul class="list">${gr.items.slice().sort((a, b) => byFecha(a.gasto, b.gasto)).map(itemRow).join("")}</ul>${gr.ruta ? `<a class="btn ghost sm" href="${gr.ruta}">Ver ficha</a>` : ""}` })).join("")
      : `<ul class="list">${l.items.slice().sort((a, b) => byFecha(a.gasto, b.gasto)).map(itemRow).join("")}</ul>`,
  });
  return {
    title: c.nombre,
    parent: "#/colecciones",
    action: `<button class="icon-btn" data-action aria-label="Editar colección">${icon("pencil")}</button>`,
    onAction: () => editarSimple("colecciones", c, "colección"),
    html: `
      ${photoHead(c.foto_id, `Foto de la colección ${c.nombre}`, prodGrid(cc.productos.map((pid) => I.producto.get(pid)).filter(Boolean)), "grid-meta")}
      <section class="card tot-strip" aria-label="Totales de la colección">
        <div class="stat"><span>Costo total</span><b class="money">${moneyM(cc.total)}</b></div>
        <div class="stat"><span>Pagado</span><b class="money">${moneyM(cc.pagado)}</b></div>
        <a class="stat stat-link" href="#/pendientes?col=${id}"><span>Pendiente</span><b class="money">${moneyM(cc.pendiente)}</b></a>
      </section>

      <h2 class="section-label">Balance de la producción</h2>
      <section class="card flush balance">
        ${colFold("Producción", L.produccion, plural(L.produccion.grupos.length, "producto"))}
        ${colFold("Muestras", L.muestras, plural(L.muestras.grupos.length, "muestra"))}
        ${colFold("Moldería todos los talles", L.molderia, plural(L.molderia.grupos.length, "molde"))}
        ${sumRow("Total de fabricación y desarrollo de la colección", cc.fabricacion, "subtotal")}
        ${colFold("Campañas de contenido", L.campana, plural(L.campana.grupos.length, "campaña"))}
        ${colFold("Publicidad de sus productos", L.publicidad, plural(L.publicidad.items.length, "gasto"))}
        ${sumRow("Costo total de la colección", cc.total, "grand")}
      </section>
      <p class="hint" style="margin:0 4px">Cada gasto se suma una sola vez. No incluye packaging ni gastos generales de la marca.</p>

      <h2 class="section-label">Productos y tandas</h2>
      <section class="card flush">
        ${cc.tandas.length ? `<ul class="list">${cc.tandas.map((t) => {
          const p = I.producto.get(t.producto_id), tc = tandaCosts(I, t.id);
          return `<li><a class="row" href="#/producto/${p.id}?tanda=${t.id}">${thumb(p)}
            <span class="row-main"><span class="row-title">${esc(tandaLabel(I, t))}</span><span class="row-sub money">${unitsTxt(tc.unidades)} · producción ${moneyM(tc.lineas.produccion.total)}</span></span>
            <span class="row-end"><b class="money">${moneyM(tc.directo)}</b>${estadoBadge(tc.estado)}</span></a></li>`;
        }).join("")}</ul>` : `<div class="empty">Sin productos. Asigná la colección desde la ficha de cada producto.</div>`}
      </section>

      <h2 class="section-label">Campañas</h2>
      <section class="card flush">${campanasList(cc.campanas)}
        <button class="row add" id="new-camp"><span class="ico-box">${icon("plus")}</span><span class="row-main">Nueva campaña en esta colección</span></button></section>

      <h2 class="section-label">Publicidad de la colección</h2>
      ${M.isZero(pc.total) ? "" : `<section class="card">
        <div class="card-head"><b class="money" style="font-size:20px">${moneyM(pc.total)}</b><span class="badge ${pcTxt[0]}">${pcTxt[1]}</span></div>
        <p class="hint" style="margin:0 0 12px">${esc(pcTxt[2])} Se reparte entre las unidades de todos sus productos.</p>
        ${pc.parts.length ? repartoTable(pc) : ""}
      </section>
      <section class="card flush">${gastoList(pc.gastos)}</section>`}
      <button class="btn secondary" id="add-publi">${icon("megaphone", "sm")} Cargar publicidad a toda la colección</button>`,
    bind() {
      bindPhoto("colecciones", id);
      $("#new-camp").onclick = () => nuevaCampana(id);
      $("#add-publi").onclick = () => openCarga(ctx, null, { categoria: "publicidad", coleccion_id: id });
    },
  };
}

// Vista previa de los productos al lado de la foto: 3 filas de 4. Se llena desde la fila de abajo, de izquierda a derecha,
// y el texto "X productos" queda justo encima de la fila más alta que tenga productos.
function prodGrid(ps) {
  const filas = [];
  for (let i = 0; i < Math.min(ps.length, 12); i += 4) filas.push(ps.slice(i, i + 4));
  const celda = (p) => `<a class="pg-cell" href="#/producto/${p.id}" aria-label="${esc(p.nombre)}">${p.foto_id
    ? `<img src="${fileUrl(p.foto_id, true)}" alt="" loading="lazy">` : icon("shirt", "sm")}</a>`;
  return `<span class="pg-label">${plural(ps.length, "producto")}</span>
    ${filas.length ? `<div class="pg">${filas.reverse().map((f) => `<div class="pg-row">${f.map(celda).join("")}</div>`).join("")}</div>`
      : `<span class="hint">Todavía no tiene productos.</span>`}`;
}

function editarSimple(table, row, nombre) {
  const archKey = table === "productos" ? "archivado" : "archivada";
  const hasCol = table === "campanas";
  sheet({
    title: `Editar ${nombre}`,
    render: ({ body, close }) => {
      body.innerHTML = `<form class="stack">
        <div class="field"><label for="e-n">Nombre</label><input id="e-n" class="input" value="${esc(row.nombre)}" required></div>
        ${hasCol ? coleccionSelect(row.coleccion_id) : ""}
        <button class="btn block">Guardar</button>
        <div class="btn-row"><button type="button" class="btn secondary" id="e-arch">${icon("archive", "sm")} ${row[archKey] ? "Desarchivar" : "Archivar"}</button>
        <button type="button" class="btn danger" id="e-del">${icon("trash", "sm")} Borrar</button></div>
        <p class="hint" style="margin:0">Archivar lo saca de las listas de carga pero conserva sus gastos.</p>
      </form>`;
      const f = $("form", body);
      f.onsubmit = (e) => {
        e.preventDefault();
        const b = { nombre: $("#e-n", body).value };
        if (hasCol) b.coleccion_id = $("#f-col", body).value || null;
        busy($("button", f), async () => { await patch(table, row.id, b, "Guardado"); close(); }).catch(() => {});
      };
      $("#e-arch", body).onclick = () => busy($("#e-arch", body), async () => { await patch(table, row.id, { [archKey]: row[archKey] ? 0 : 1 }, row[archKey] ? "Activo de nuevo" : "Archivado"); close(); }).catch(() => {});
      $("#e-del", body).onclick = async () => {
        if (!(await confirmSheet({ title: `Borrar ${nombre}`, text: `Se borra “${esc(row.nombre)}”. Si tiene gastos, no se puede: archivalo.`, ok: "Borrar", danger: true }))) return;
        try { await api(`${table}/${row.id}`, { method: "DELETE" }); close(); history.back(); await reload(); toast("Borrado"); }
        catch (err) { toast(err.message, true); }
      };
    },
  });
}

/* ================= Campaña ================= */

function vCampana(id) {
  const I = S.I;
  const c = I.campana.get(id);
  if (!c) return null;
  const info = campaignInfo(I, id);
  const estadoTxt = {
    sin_productos: ["warn", "Sin productos participantes", "Elegí los productos que participaron para repartir el gasto."],
    falta_cantidad: ["warn", "Reparto pendiente", `Falta la cantidad de: ${info.faltan.map((p) => tandaLabel(I, p.tanda)).join(", ")}.`],
    estimado: ["info", "Reparto estimado", "Usa cantidades o importes estimados. Se recalcula solo cuando cargues los finales."],
    final: ["ok", "Reparto final", "Con cantidades finales."],
  }[info.estado];
  return {
    title: c.nombre,
    parent: "#/colecciones",
    action: `<button class="icon-btn" data-action aria-label="Editar campaña">${icon("pencil")}</button>`,
    onAction: () => editarSimple("campanas", c, "campaña"),
    html: `
      <section class="card">
        <div class="hero-label">Gasto de la campaña${c.coleccion_id ? ` · ${esc(I.coleccion.get(c.coleccion_id)?.nombre)}` : ""}</div>
        <div class="hero-value money">${moneyM(info.total)}</div>
        <div style="margin-top:8px"><span class="badge ${estadoTxt[0]}">${estadoTxt[1]}</span></div>
        <p class="hint" style="margin:8px 0 0">${esc(estadoTxt[2])}</p>
      </section>

      <h2 class="section-label">Gastos de la campaña</h2>
      <section class="card flush">${gastoList(info.gastos, { showCat: false })}</section>
      <button class="btn" id="add-g">${icon("plus")} Cargar gasto a esta campaña</button>

      <h2 class="section-label">Reparto por unidades</h2>
      <section class="card">
        ${info.parts.length ? `${repartoTable(info)}
        <p class="hint" style="margin:12px 0 0">Cada unidad participante absorbe la misma parte: gasto × unidades del producto ÷ unidades totales. La campaña se cuenta una sola vez en la colección.</p>`
        : `<div class="empty" style="padding:8px">Todavía no hay productos participantes.</div>`}
        <button class="btn secondary block" id="parts" style="margin-top:12px">${icon("shirt", "sm")} Elegir productos participantes</button>
      </section>`,
    bind() {
      $("#parts").onclick = () => elegirParticipantes(c, info);
      $("#add-g").onclick = () => openCarga(ctx, null, { categoria: "campanas", campana_id: id });
    },
  };
}

function repartoTable(info) {
  const I = S.I;
  return `<table class="cost-table"><thead><tr><th>Producto</th><th>Unid.</th><th>Asignado</th><th>Por u.</th></tr></thead><tbody>
    ${info.parts.map((p) => {
      const a = info.asignado.get(p.tanda.id);
      return `<tr><td><a href="#/producto/${p.tanda.producto_id}?tanda=${p.tanda.id}">${esc(tandaLabel(I, p.tanda))}</a></td>
        <td class="money">${p.n == null ? '<span class="badge warn">Falta</span>' : fmtInt(p.n) + (p.estimada ? '<span class="sub">est.</span>' : "")}</td>
        <td class="money">${a ? moneyM(a) : "—"}</td><td class="money">${a && p.n ? perUnit(a, p.n) : "—"}</td></tr>`;
    }).join("")}
    <tr class="total"><td>Total</td><td class="money">${info.totalUnidades ? fmtInt(info.totalUnidades) : "—"}</td><td class="money">${info.asignado.size ? moneyM(M.sum([...info.asignado.values()])) : "—"}</td><td></td></tr>
  </tbody></table>`;
}

function elegirParticipantes(c, info) {
  const I = S.I;
  const sel = new Set(info.parts.map((p) => p.tanda.id));
  const prods = S.data.productos.filter((p) => !p.archivado).sort((a, b) =>
    (a.coleccion_id === c.coleccion_id ? -1 : 0) - (b.coleccion_id === c.coleccion_id ? -1 : 0) || a.nombre.localeCompare(b.nombre));
  sheet({
    title: "Productos participantes",
    foot: true,
    render: ({ body, foot, close }) => {
      body.innerHTML = prods.length ? `<p class="hint" style="margin:0">Marcá cada producto (y su tanda) que aparece en la campaña. El gasto se reparte por sus unidades.</p>
        <div class="card flush"><ul class="list">${prods.flatMap((p) => (I.tandasDeProducto.get(p.id) || []).map((t) => {
          const u = unidades(t);
          return `<li><label class="row"><input type="checkbox" value="${t.id}" ${sel.has(t.id) ? "checked" : ""} style="width:22px;height:22px">
            ${thumb(p)}<span class="row-main"><span class="row-title">${esc(tandaLabel(I, t))}</span>
            <span class="row-sub">${esc(I.coleccion.get(tandaColeccionId(I, t))?.nombre || "Sin colección")} · ${unitsTxt(u)}</span></span></label></li>`;
        })).join("")}</ul></div>` : `<div class="empty">Primero creá productos.</div>`;
      foot.innerHTML = `<button class="btn block">Guardar y recalcular</button>`;
      $("button", foot).onclick = (e) => busy(e.currentTarget, async () => {
        const ids = $$("input[type=checkbox]:checked", body).map((x) => Number(x.value));
        await api(`campanas/${c.id}/tandas`, { method: "PUT", body: { tanda_ids: ids } });
        await reload();
        toast("Reparto recalculado");
        close();
      }).catch(() => {});
    },
  });
}

/* ================= Muestra ================= */

function vMuestra(id) {
  const I = S.I;
  const m = I.muestra.get(id);
  if (!m) return null;
  const gs = I.gastosDeMuestra.get(id) || [];
  const prod = m.producto_id ? I.producto.get(m.producto_id) : null;
  const telas = telasDeMuestra(I, id);
  const noProduce = !!m.no_produce;
  return {
    title: m.nombre,
    parent: "#/gestionar/muestras",
    action: `<button class="icon-btn" data-action aria-label="Editar muestra">${icon("pencil")}</button>`,
    onAction: () => editarSimple("muestras", m, "muestra"),
    html: `
      ${photoHead(m.foto_id, `Foto de la muestra ${m.nombre}`, `<span class="hero-label">Total acumulado</span>
        <b class="head-value big money">${moneyM(tot(gs))}</b><span class="hint" style="margin:-8px 0 8px">${plural(gs.length, "gasto")}</span>`)}
      <section class="card">
        <div class="hero-label">Tela/s utilizada/s</div>
        ${telas.length ? `<ul class="tela-list">${telas.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`
          : `<p class="hint" style="margin:4px 0 0">Todavía no hay tela cargada. Sale de los gastos con concepto Tela (el nombre es la descripción).</p>`}
      </section>
      <h2 class="section-label">Gastos</h2>
      <section class="card flush">${gastoList(gs, { showCat: false })}</section>
      <button class="btn" id="add-g">${icon("plus")} Cargar gasto a esta muestra</button>
      <h2 class="section-label">Producción</h2>
      <section class="card flush">
        ${noProduce ? "" : `<button class="row" id="link">${prod ? thumb(prod) : `<span class="ico-box">${icon("link")}</span>`}
          <span class="row-main"><span class="row-title">${prod ? esc(prod.nombre) : "Vincular a un producto"}</span>
          <span class="row-sub wrap">${prod ? "Producto vinculado · tocá para cambiar" : "Cuando llegue a producción, su costo suma al desarrollo del producto"}</span></span>${icon("right", "chev")}</button>`}
        <label class="row check-row"><input type="checkbox" id="no-prod" ${noProduce ? "checked" : ""}>
          <span class="row-main"><span class="row-title">No se va a producir</span>
          <span class="row-sub wrap">Lo gastado pasa a “Gastos no asignados” del Resumen, como gasto extra.</span></span></label>
      </section>`,
    bind() {
      bindPhoto("muestras", id);
      $("#add-g").onclick = () => openCarga(ctx, null, { categoria: "muestras", muestra_id: id });
      $("#no-prod").onchange = (e) => {
        const on = e.target.checked;
        patch("muestras", id, on ? { no_produce: 1, producto_id: null } : { no_produce: 0 },
          on ? (prod ? `Desvinculada de ${prod.nombre} · pasa a gastos no asignados` : "Pasa a gastos no asignados") : "Vuelve a contar como desarrollo")
          .catch((err) => { e.target.checked = !on; toast(err.message, true); });
      };
      $("#link")?.addEventListener("click", () => sheet({
        title: "Vincular a producto",
        render: ({ body, close }) => {
          const ps = S.data.productos.filter((p) => !p.archivado);
          body.innerHTML = `<div class="card flush"><ul class="list">
            <li><button class="row" data-p=""><span class="ico-box">${icon("x")}</span><span class="row-main">Sin vincular</span></button></li>
            ${ps.map((p) => `<li><button class="row" data-p="${p.id}">${thumb(p)}<span class="row-main"><span class="row-title">${esc(p.nombre)}</span></span>${p.id === m.producto_id ? icon("check") : ""}</button></li>`).join("")}
          </ul></div>`;
          $$("[data-p]", body).forEach((b) => (b.onclick = () => busy(b, async () => { await patch("muestras", id, { producto_id: b.dataset.p || null }, "Vinculación guardada"); close(); }).catch(() => {})));
        },
      }));
    },
  };
}

/* ================= Suscripción / insumo ================= */

function vOpcion(id) {
  const I = S.I;
  const o = I.opcion.get(id);
  if (!o) return null;
  const gs = I.gastosDeOpcion.get(id) || [];
  const isPack = o.tipo === "packaging";
  const unidadesTot = gs.reduce((s, g) => s + (g.cantidad || 0), 0);
  return {
    title: o.nombre,
    parent: `#/gestionar/${o.tipo}`,
    action: `<button class="icon-btn" data-action aria-label="Editar">${icon("pencil")}</button>`,
    onAction: () => editarSimple("opciones", o, "opción"),
    html: `
      <section class="card"><div class="hero-label">Total pagado registrado</div><div class="hero-value money">${moneyM(tot(gs))}</div>
        <div class="hero-sub">${plural(gs.length, "compra")}${isPack && unidadesTot ? ` · ${fmtInt(unidadesTot)} unidades compradas` : ""}</div></section>
      ${isPack ? `<p class="hint" style="margin:0 4px">Se registra como gasto general de packaging. No se reparte entre productos ni se asume que se consumió todo.</p>` : `<p class="hint" style="margin:0 4px">Gasto general de la marca. No se asigna a productos.</p>`}
      <section class="card flush">${gs.length ? `<ul class="list">${gs.map((g) => `<li><a class="row" href="#/gasto/${g.id}">
        <span class="row-main"><span class="row-title">${esc(g.descripcion || fmtDateLong(g.fecha))}</span>
        <span class="row-sub">${esc(fmtDate(g.fecha))}${g.cantidad ? ` · ${fmtInt(g.cantidad)} u. a ${money(g.monto / g.cantidad, g.moneda, true)} c/u` : ""}${g.cubre_meses > 1 ? ` · cubre ${g.cubre_meses} meses` : ""}</span></span>
        <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b>${PAGO_BADGE[pagoInfo(I, g).estado]}</span></a></li>`).join("")}</ul>` : `<div class="empty">Sin gastos todavía</div>`}</section>
      <button class="btn" id="add-g">${icon("plus")} Cargar gasto</button>`,
    bind() { $("#add-g").onclick = () => openCarga(ctx, null, { categoria: isPack ? "packaging" : "suscripciones", opcion_id: id }); },
  };
}

/* ================= Movimientos ================= */

function gastoColeccion(I, g) {
  if (g.coleccion_id) return g.coleccion_id;
  if (g._vinc) return gastoColeccion(I, I.vinculosDe.get(g.id)[0]);
  if (g._multi) return tandaColeccionId(I, I.tanda.get(I.tandasDeGasto.get(g.id)[0]) || {});
  if (g.tanda_id) return tandaColeccionId(I, I.tanda.get(g.tanda_id) || {});
  if (g.campana_id) return I.campana.get(g.campana_id)?.coleccion_id ?? null;
  if (g.producto_id) return I.producto.get(g.producto_id)?.coleccion_id ?? null;
  if (g.muestra_id) return I.producto.get(I.muestra.get(g.muestra_id)?.producto_id)?.coleccion_id ?? null;
  return null;
}
function gastoProducto(I, g) {
  if (g.producto_id) return g.producto_id;
  if (g.tanda_id) return I.tanda.get(g.tanda_id)?.producto_id;
  if (g.muestra_id) return I.muestra.get(g.muestra_id)?.producto_id;
  return null;
}

function vMovimientos(q) {
  const I = S.I, D = S.data;
  const f = { per: q.get("per") ?? thisMonth(), cat: q.get("cat") || "", prod: q.get("prod") || "", col: q.get("col") || "", estado: q.get("estado") || "", q: q.get("q") || "" };
  const setF = (patch) => {
    const n = { ...f, ...patch };
    const qs = new URLSearchParams(Object.entries(n).filter(([, v]) => v !== ""));
    if (n.per === "") qs.set("per", "todo");
    history.replaceState(null, "", "#/movimientos?" + qs.toString());
    render(true);
  };
  const per = f.per === "todo" ? "" : f.per;
  const txt = f.q.toLowerCase();
  const lista = D.gastos.filter((g) => {
    if (per && !inPeriod(g.fecha, per)) return false;
    if (f.cat === "envio" ? !g.envio : f.cat && (g.categoria || "sin") !== f.cat) return false;
    if (f.prod && String(gastoProducto(I, g)) !== f.prod &&
      !(I.partesDe.get(g.id) || [g]).some((x) => String(gastoProducto(I, x)) === f.prod ||
        (x._tandas || []).some((id) => String(I.tanda.get(id)?.producto_id) === f.prod))) return false;
    if (f.col && String(gastoColeccion(I, g)) !== f.col) return false;
    if (f.estado === "sin_asignar" && !faltaAsignar(g)) return false;
    if (f.estado === "estimado" && !g.estimado) return false;
    if (["pagado", "parcial", "pendiente"].includes(f.estado) && pagoInfo(I, g).estado !== f.estado) return false;
    if (txt && ![gastoTitulo(I, g), g.descripcion, g.proveedor, g.medio_pago, CAT[g.categoria]?.nombre].join(" ").toLowerCase().includes(txt)) return false;
    return true;
  });
  const groups = new Map();
  for (const g of lista) { if (!groups.has(g.fecha)) groups.set(g.fecha, []); groups.get(g.fecha).push(g); }
  const opt = (v, t, cur) => `<option value="${v}" ${String(cur) === String(v) ? "selected" : ""}>${esc(t)}</option>`;
  const nFil = [f.cat, f.prod, f.col, f.estado].filter(Boolean).length;

  return {
    title: "Movimientos",
    html: `
      ${per ? periodNav(per, "mp") : ""}
      <div class="btn-row" style="align-items:center"><button class="btn ghost sm" id="all-time" style="flex:0 1 auto">${per ? "Ver todas las fechas" : "Ver por mes"}</button></div>
      <div class="search">${icon("search")}<input class="input" id="m-q" type="search" placeholder="Buscar descripción, proveedor…" value="${esc(f.q)}" aria-label="Buscar"></div>
      <details class="card" style="padding:0" ${nFil ? "open" : ""}><summary class="row" style="border:0">${icon("sliders")}<span class="row-main">Filtros${nFil ? ` (${nFil})` : ""}</span>${icon("down", "chev")}</summary>
        <div class="grid-2" style="padding:0 16px 16px">
          <div class="field"><label for="m-cat">Categoría</label><select id="m-cat" class="select">${opt("", "Todas", f.cat)}${CATEGORIAS.map((c) => opt(c.key, c.nombre, f.cat)).join("")}${opt("envio", "Envíos y cadetes", f.cat)}${opt("sin", "Sin categoría", f.cat)}</select></div>
          <div class="field"><label for="m-est">Estado</label><select id="m-est" class="select">${[["", "Todos"], ["pagado", "Pagado"], ["parcial", "Pago parcial"], ["pendiente", "Pendiente"], ["sin_asignar", "Sin asignar"], ["estimado", "Estimado"]].map(([v, t]) => opt(v, t, f.estado)).join("")}</select></div>
          <div class="field"><label for="m-prod">Producto</label><select id="m-prod" class="select">${opt("", "Todos", f.prod)}${D.productos.map((p) => opt(p.id, p.nombre, f.prod)).join("")}</select></div>
          <div class="field"><label for="m-col">Colección</label><select id="m-col" class="select">${opt("", "Todas", f.col)}${D.colecciones.map((c) => opt(c.id, c.nombre, f.col)).join("")}</select></div>
        </div>
        ${nFil ? `<button class="btn ghost sm" id="m-clear" style="margin:0 8px 8px">Quitar filtros</button>` : ""}
      </details>
      <section class="card flush">
        ${lista.length ? [...groups].map(([fecha, gs]) => `<div class="card-head pad" style="margin:0"><span class="xs muted day-head" style="font-weight:600">${esc(fmtDateLong(fecha))}${fecha.slice(0, 4) !== String(new Date().getFullYear()) ? " " + fecha.slice(0, 4) : ""}</span></div>
          <ul class="list">${gs.map((g) => gastoRow(g)).join("")}</ul>`).join("")
          : `<div class="empty">No hay gastos con estos filtros.</div>`}
        ${lista.length ? `<div class="row" style="font-weight:650"><span class="row-main">${plural(lista.length, "gasto")}</span><span class="row-end"><b class="money">${moneyM(tot(lista))}</b></span></div>` : ""}
      </section>
      <button class="btn secondary" id="csv">${icon("download", "sm")} Exportar esta lista (CSV)</button>`,
    bind() {
      if (per) bindPeriod(() => per, (p) => setF({ per: p }), "mp");
      $("#all-time").onclick = () => setF({ per: per ? "todo" : thisMonth() });
      let t;
      $("#m-q").oninput = (e) => { clearTimeout(t); t = setTimeout(() => { setF({ q: e.target.value }); const i = $("#m-q"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 350); };
      $("#m-cat").onchange = (e) => setF({ cat: e.target.value });
      $("#m-est").onchange = (e) => setF({ estado: e.target.value });
      $("#m-prod").onchange = (e) => setF({ prod: e.target.value });
      $("#m-col").onchange = (e) => setF({ col: e.target.value });
      $("#m-clear")?.addEventListener("click", () => setF({ cat: "", prod: "", col: "", estado: "" }));
      $("#csv").onclick = () => exportCsv(lista);
    },
  };
}

function exportCsv(lista) {
  const I = S.I;
  const rows = [["Fecha", "Importe", "Moneda", "Categoría", "Asociado a", "Concepto", "Descripción", "Medio de pago", "Estado del pago", "Pagado", "Pendiente", "Proveedor", "Cantidad", "Kg de tela", "Tipo de estampa", "Envío", "Estimado"]];
  for (const g of lista) {
    const p = pagoInfo(I, g);
    rows.push([g.fecha, (g.monto / 100).toFixed(2).replace(".", ","), g.moneda, CAT[g.categoria]?.nombre || "Sin categoría", destinoTexto(I, g) || "",
      g.concepto || "", g.descripcion || "", g.medio_pago || "", { pagado: "Pagado", parcial: "Pago parcial", pendiente: "Pendiente" }[p.estado],
      (p.pagado / 100).toFixed(2).replace(".", ","), (p.pendiente / 100).toFixed(2).replace(".", ","), g.proveedor || "", g.cantidad || "", g.kg ? String(g.kg).replace(".", ",") : "", ESTAMPA[g.estampa] || "", ENVIO[g.envio] || "", g.estimado ? "Sí" : ""]);
  }
  const csv = "﻿" + rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8" }), `gastos-desgoises-${today()}.csv`);
}
function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= Detalle de gasto ================= */

function vGasto(id) {
  const I = S.I;
  const g = I.gasto.get(id);
  if (!g) return null;
  const c = CAT[g.categoria];
  const p = pagoInfo(I, g);
  const pagos = I.pagosDe.get(id) || [];
  const t = g.tanda_id ? I.tanda.get(g.tanda_id) : null;
  const bloqueado = !!t?.cerrada;
  const destLink = g.muestra_id ? `#/muestra/${g.muestra_id}` : t ? `#/producto/${t.producto_id}?tanda=${t.id}` : g.producto_id ? `#/producto/${g.producto_id}`
    : g.campana_id ? `#/campana/${g.campana_id}` : g.opcion_id ? `#/opcion/${g.opcion_id}` : g.coleccion_id ? `#/coleccion/${g.coleccion_id}` : null;
  const dest = destinoTexto(I, g);
  const dato = (k, v) => (v ? `<li class="row" style="min-height:48px"><span class="row-main muted small">${k}</span><span class="row-end" style="max-width:65%;text-align:right;white-space:normal">${v}</span></li>` : "");

  return {
    title: "Gasto",
    parent: "#/movimientos",
    html: `
      <section class="card">
        <div class="hero-label">${g.envio ? `${esc(ENVIO[g.envio])} · ` : ""}${esc(c?.nombre || "Sin categoría")}</div>
        <div class="hero-value money">${money(g.monto, g.moneda)}</div>
        <div class="hero-sub">${esc(gastoTitulo(I, g))}</div>
        <div class="chips" style="margin-top:8px">${p.estado === "pagado" ? '<span class="badge ok">Pagado</span>' : PAGO_BADGE[p.estado]}${g.estimado ? '<span class="badge info">Importe estimado</span>' : ""}${faltaAsignar(g) ? '<span class="badge warn">Pendiente de asignar</span>' : ""}</div>
        ${p.estado !== "pagado" ? `<div class="stats three"><div class="stat"><span>Costo acordado</span><b class="money">${money(p.acordado, g.moneda)}</b></div>
          <div class="stat"><span>Pagado</span><b class="money">${money(p.pagado, g.moneda)}</b></div>
          <div class="stat"><span>Pendiente</span><b class="money">${money(p.pendiente, g.moneda)}</b></div></div>` : ""}
      </section>
      ${faltaAsignar(g) ? `<div class="note warn">${icon("alert", "sm")}<span>${g.categoria ? "Falta elegir a qué corresponde." : "Falta la categoría."} Tocá “Editar” para completarlo.</span></div>` : ""}
      ${bloqueado ? `<div class="note warn">${icon("lock", "sm")}<span>Pertenece a una tanda cerrada. Reabrila para corregirlo.</span></div>` : ""}

      <section class="card flush"><ul class="list">
        ${dato("Fecha", esc(fmtDateLong(g.fecha)) + " " + g.fecha.slice(0, 4))}
        ${dest ? dato("Asociado a", destLink ? `<a href="${destLink}" style="color:var(--accent);font-weight:600">${esc(dest)}</a>` : esc(dest)) : ""}
        ${dato("Concepto", esc(g.concepto))}
        ${esEstampa(g.concepto) && ESTAMPA[g.estampa] ? dato("Tipo de estampa", esc(ESTAMPA[g.estampa])) : ""}
        ${dato("Descripción", esc(g.descripcion))}
        ${dato("Medio de pago", esc(g.medio_pago))}
        ${dato("Proveedor", esc(g.proveedor))}
        ${g.cantidad ? dato("Cantidad", `${fmtInt(g.cantidad)} u. · ${money(g.monto / g.cantidad, g.moneda, true)} c/u`) : ""}
        ${g.kg ? dato("Tela", `${fmtKg(g.kg, 3)} kg · ${money(g.monto / g.kg, g.moneda, true)} por kg`) : ""}
        ${g.cubre_meses > 1 ? dato("Período que cubre", `${g.cubre_meses} meses (${money(g.monto / g.cubre_meses, g.moneda)} por mes)`) : ""}
        ${g.en_cantidad ? dato("Tipo", "Compra de insumos en cantidad") : ""}
        ${g.envio ? dato("Envío", esc(ENVIO[g.envio])) : ""}
      </ul></section>
      ${repartoGasto(g)}

      ${g.comprobante_id ? `<a class="btn secondary" href="${fileUrl(g.comprobante_id)}" target="_blank" rel="noopener">${icon("file", "sm")} Ver comprobante</a>` : ""}

      <h2 class="section-label">Pagos</h2>
      <section class="card flush">
        ${pagos.length ? `<ul class="list">${pagos.map((x) => `<li class="row"><span class="row-main"><span class="row-title">${esc(fmtDate(x.fecha))}</span><span class="row-sub">${esc(x.medio_pago || "")}</span></span>
          <span class="row-end"><b class="money">${money(x.monto, g.moneda)}</b></span><button class="icon-btn" data-delpago="${x.id}" aria-label="Borrar pago">${icon("trash", "sm")}</button></li>`).join("")}</ul>` : `<div class="empty">Sin pagos registrados.</div>`}
        ${p.pendiente > 0 ? `<button class="row add" id="pay"><span class="ico-box">${icon("wallet")}</span><span class="row-main">Registrar pago del saldo</span></button>` : ""}
      </section>
      <p class="hint" style="margin:0 4px">Registrar un pago no agrega costo: solo cambia cuánto está pagado.</p>

      <div class="btn-row">
        <button class="btn" id="edit" ${bloqueado ? "disabled" : ""}>${icon("pencil", "sm")} Editar</button>
        <button class="btn danger" id="del" ${bloqueado ? "disabled" : ""}>${icon("trash", "sm")} Borrar</button>
      </div>`,
    bind() {
      $("#edit").onclick = () => openCarga(ctx, g);
      $("#del").onclick = async () => {
        if (!(await confirmSheet({ title: "Borrar gasto", text: `Se borra el gasto de ${money(g.monto, g.moneda)} y sus pagos. Los totales se recalculan.`, ok: "Borrar", danger: true }))) return;
        try { await api(`gastos/${id}`, { method: "DELETE" }); history.back(); await reload(); toast("Gasto borrado"); }
        catch (err) { toast(err.message, true); }
      };
      $("#pay")?.addEventListener("click", () => registrarPago(g, p));
      $$("[data-delpago]").forEach((b) => (b.onclick = async () => {
        if (!(await confirmSheet({ title: "Borrar pago", text: "El importe vuelve a figurar como pendiente.", ok: "Borrar", danger: true }))) return;
        try { await api(`pagos/${b.dataset.delpago}`, { method: "DELETE" }); await reload(); toast("Pago borrado"); }
        catch (err) { toast(err.message, true); }
      }));
    },
  };
}

// En el detalle de un gasto: cómo se reparte (envío entre compras, moldería entre productos) y qué envíos tiene.
function repartoGasto(g) {
  const I = S.I;
  const fila = (href, titulo, sub, m, extra = "") => `<li><a class="row" href="${href}"><span class="row-main"><span class="row-title wrap">${esc(titulo)}</span>
    ${sub ? `<span class="row-sub wrap">${esc(sub)}</span>` : ""}</span><span class="row-end"><b class="money">${m}</b>${extra}</span></a></li>`;
  let html = "";
  const partes = I.partesDe.get(g.id);
  if (partes) {
    html += `<h2 class="section-label">Repartido entre</h2><section class="card flush"><ul class="list">${partes.map((x) => {
      const pct = g.monto ? (x._ref.monto / partes.reduce((s, y) => s + y._ref.monto, 0)) * 100 : 0;
      return fila(`#/gasto/${x._ref.id}`, compraNombre(I, x._ref), `Compra de ${money(x._ref.monto, x._ref.moneda)} · ${pctTxt(pct)} del total`, money(x.monto, g.moneda));
    }).join("")}</ul></section>
    <p class="hint" style="margin:0 4px">El envío se reparte según lo que costó cada compra, y cada parte se suma a esa compra con su mismo concepto.</p>`;
  }
  if (g._multi && g.categoria === "molderia") {
    const info = multiInfo(I, g);
    html += `<h2 class="section-label">Productos que usan esta moldería</h2><section class="card flush"><ul class="list">${info.parts.map((p) => {
      const a = info.asignado.get(p.tanda.id);
      return fila(`#/producto/${p.tanda.producto_id}`, I.producto.get(p.tanda.producto_id)?.nombre || "Producto",
        p.n == null ? "Falta la cantidad" : `${fmtInt(p.n)} u.${p.estimada ? " estimadas" : ""}`, a ? moneyM(a) : "Pendiente",
        a && p.n ? `<span class="row-sub">${perUnit(a, p.n)} por u.</span>` : "");
    }).join("")}</ul></section>
    <p class="hint" style="margin:0 4px">El total se divide entre las unidades de todos estos productos (las de su primera producción).</p>`;
  }
  const envios = I.enviosDe.get(g.id);
  if (envios) {
    html += `<h2 class="section-label">Envíos de esta compra</h2><section class="card flush"><ul class="list">${envios.map((e) => {
      const parte = I.partesDe.get(e.id)?.find((x) => x._ref.id === g.id);
      return fila(`#/gasto/${e.id}`, gastoNombre(e), `${ENVIO[e.envio] || "Envío"} · ${fmtDate(e.fecha)}`, money(parte?.monto ?? e.monto, e.moneda),
        parte && parte.monto !== e.monto ? `<span class="row-sub">de ${money(e.monto, e.moneda)}</span>` : "");
    }).join("")}</ul></section>`;
  }
  return html;
}

/* ================= Saldos pendientes ================= */

// Todo lo que falta pagar, del más viejo al más nuevo. Tocar uno abre "Registrar pago" con el saldo ya puesto.
function vPendientes(q) {
  const I = S.I;
  const col = q.get("col") ? Number(q.get("col")) : null;
  const lista = S.data.gastos.filter((g) => pagoInfo(I, g).pendiente > 0 && (col == null || gastoColeccion(I, g) === col))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id);
  const total = M.sum(lista.map((g) => M.of(g.moneda, pagoInfo(I, g).pendiente)));
  const colNombre = col != null ? I.coleccion.get(col)?.nombre : null;
  return {
    title: "Saldos pendientes",
    parent: "#/resumen",
    html: `
      <section class="card">
        <div class="hero-label">Falta pagar${colNombre ? ` · ${esc(colNombre)}` : ""}</div>
        <div class="hero-value money">${moneyM(total)}</div>
        <div class="hero-sub">${plural(lista.length, "gasto")} con saldo</div>
      </section>
      <section class="card flush">
        ${lista.length ? `<ul class="list">${lista.map((g) => {
          const p = pagoInfo(I, g);
          const sub = [destinoTexto(I, g) || CAT[g.categoria]?.nombre, fmtDate(g.fecha), p.pagado ? `pagado ${money(p.pagado, g.moneda)} de ${money(g.monto, g.moneda)}` : "sin pagos"].filter(Boolean).join(" · ");
          return `<li><button class="row" data-pay="${g.id}"><span class="ico-box">${icon("wallet")}</span>
            <span class="row-main"><span class="row-title wrap">${esc(gastoNombre(g))}</span><span class="row-sub wrap">${esc(sub)}</span></span>
            <span class="row-end"><b class="money">${money(p.pendiente, g.moneda)}</b><span class="row-sub">Registrar pago</span></span></button></li>`;
        }).join("")}</ul>` : `<div class="empty">${icon("check_circle", "lg")}<div>No hay saldos pendientes.</div></div>`}
      </section>
      <p class="hint" style="margin:0 4px">Tocá un gasto para registrar el pago. Viene puesto todo el saldo; si pagaste una parte, cambiá el importe.</p>`,
    bind() {
      $$("[data-pay]").forEach((b) => (b.onclick = () => {
        const g = I.gasto.get(Number(b.dataset.pay));
        registrarPago(g, pagoInfo(I, g));
      }));
    },
  };
}

function registrarPago(g, p) {
  const medios = S.data.opciones.filter((o) => o.tipo === "medio_pago" && !o.archivada);
  let medio = g.medio_pago;
  sheet({
    title: "Registrar pago",
    render: ({ body, close }) => {
      body.innerHTML = `<form class="stack">
        <div class="field"><label for="p-m">Importe pagado</label><input id="p-m" class="input money" inputmode="decimal" value="${centsToInput(p.pendiente)}">
          <span class="hint">Pendiente: ${money(p.pendiente, g.moneda)}</span></div>
        <div class="field"><label for="p-f">Fecha</label><input id="p-f" type="date" class="input" value="${today()}"></div>
        <div class="field"><span class="label">Medio de pago</span><div class="chips">${medios.map((o) => `<button type="button" class="chip" data-m="${esc(o.nombre)}" aria-pressed="${o.nombre === medio}">${esc(o.nombre)}</button>`).join("")}</div></div>
        <div class="error-text" id="p-err" hidden></div>
        <button class="btn block">Guardar pago</button></form>`;
      const inp = $("#p-m", body);
      inp.oninput = () => liveFormat(inp);
      $$("[data-m]", body).forEach((b) => (b.onclick = () => { medio = b.dataset.m; $$("[data-m]", body).forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.m === medio))); }));
      $("form", body).onsubmit = (e) => {
        e.preventDefault();
        const monto = parseAmount(inp.value);
        if (!monto || monto > p.pendiente) { $("#p-err", body).textContent = `Tiene que ser mayor a cero y hasta ${money(p.pendiente, g.moneda)}.`; $("#p-err", body).hidden = false; return; }
        busy($("form > button", body), async () => {
          await api("pagos", { method: "POST", body: { gasto_id: g.id, fecha: $("#p-f", body).value || today(), monto, medio_pago: medio } });
          await reload();
          toast(monto === p.pendiente ? "Saldo cancelado" : "Pago registrado");
          close();
        }).catch(() => {});
      };
    },
  });
}

/* ================= Gestionar ================= */

const LISTAS = {
  muestras: { titulo: "Muestras", table: "muestras", link: (x) => `#/muestra/${x.id}`, icon: "scissors", nuevo: "Nueva muestra", label: "Nombre de la muestra" },
  molderia: { titulo: "Moldería todos los talles", icon: "ruler" },
  colecciones: { titulo: "Colecciones", table: "colecciones", link: (x) => `#/coleccion/${x.id}`, icon: "layers", nuevo: "Nueva colección", label: "Nombre de la colección" },
  campanas: { titulo: "Campañas de contenido", table: "campanas", link: (x) => `#/campana/${x.id}`, icon: "camera", nuevo: "Nueva campaña", label: "Nombre de la campaña" },
  suscripcion: { titulo: "Suscripciones y fijos", tipo: "suscripcion", link: (x) => `#/opcion/${x.id}`, icon: "repeat", nuevo: "Agregar servicio", label: "Nombre del servicio" },
  packaging: { titulo: "Packaging y presentación", tipo: "packaging", link: (x) => `#/opcion/${x.id}`, icon: "package", nuevo: "Agregar insumo", label: "Nombre del insumo" },
  concepto_prod: { titulo: "Conceptos de producción", tipo: "concepto_prod", cat: "produccion", icon: "tag", nuevo: "Agregar concepto", label: "Concepto", hint: "Aparecen como opciones rápidas al cargar producción y en la lista de pendientes de cada tanda." },
  concepto_muestra: { titulo: "Conceptos de muestras", tipo: "concepto_muestra", cat: "muestras", icon: "tag", nuevo: "Agregar concepto", label: "Concepto", hint: "Aparecen como opciones rápidas al cargar un gasto de muestras." },
  concepto_molde: { titulo: "Conceptos de moldería", tipo: "concepto_molde", cat: "molderia", icon: "tag", nuevo: "Agregar concepto", label: "Concepto", hint: "Aparecen al cargar moldería de todos los talles y al cargar un envío." },
  concepto_campana: { titulo: "Conceptos de campaña", tipo: "concepto_campana", cat: "campanas", icon: "tag", nuevo: "Agregar concepto", label: "Concepto" },
  medio_pago: { titulo: "Medios de pago", tipo: "medio_pago", icon: "wallet", nuevo: "Agregar medio de pago", label: "Medio de pago" },
};

function vGestionar() {
  const D = S.data;
  const n = (k) => {
    const L = LISTAS[k];
    if (k === "molderia") return moldesCargados().length;
    return (L.table ? D[L.table] : D.opciones.filter((o) => o.tipo === L.tipo)).filter((x) => !x.archivada).length;
  };
  const link = (k) => `<li><a class="row" href="#/gestionar/${k}"><span class="ico-box">${icon(LISTAS[k].icon)}</span>
    <span class="row-main"><span class="row-title">${LISTAS[k].titulo}</span></span><span class="row-end muted">${n(k)}</span>${icon("right", "chev")}</a></li>`;
  return {
    title: "Gestionar",
    html: `
      <section class="card flush"><ul class="list">${["muestras", "molderia"].map(link).join("")}</ul></section>
      <h2 class="section-label">Opciones de carga</h2>
      <section class="card flush"><ul class="list">${["suscripcion", "packaging", "concepto_prod", "concepto_muestra", "concepto_molde", "concepto_campana", "medio_pago"].map(link).join("")}</ul></section>
      <h2 class="section-label">Herramientas</h2>
      <section class="card flush"><ul class="list">
        <li><a class="row" href="#/simular"><span class="ico-box">${icon("calculator")}</span><span class="row-main"><span class="row-title wrap">Simular cobertura de gastos generales</span><span class="row-sub">Cuánto debería cubrir cada venta</span></span>${icon("right", "chev")}</a></li>
      </ul></section>
      <h2 class="section-label">Datos</h2>
      <section class="card flush"><ul class="list">
        <li><button class="row" id="imp"><span class="ico-box">${icon("upload")}</span><span class="row-main"><span class="row-title">Importar gastos de Notion</span><span class="row-sub">Trae los gastos viejos una sola vez; no duplica</span></span></button></li>
        <li><button class="row" id="bkp"><span class="ico-box">${icon("download")}</span><span class="row-main"><span class="row-title">Descargar copia de seguridad</span><span class="row-sub">Todos los datos en un archivo</span></span></button></li>
        <li><button class="row" id="out"><span class="ico-box">${icon("logout")}</span><span class="row-main"><span class="row-title">Cerrar sesión en este teléfono</span></span></button></li>
      </ul></section>`,
    bind() {
      $("#imp").onclick = async () => {
        if (!(await confirmSheet({ title: "Importar de Notion", text: "Se traen los gastos de la base de Notion. Los que no tengan producto, muestra o campaña van a quedar como “pendientes de asignar” para que los completes cuando quieras. Si ya se importaron, no se duplican.", ok: "Importar" }))) return;
        toast("Importando…");
        try { const r = await api("importar-notion", { method: "POST" }); await reload(); toast(`Listo: ${r.nuevos} gastos nuevos de ${r.leidos} leídos`); }
        catch (err) { toast(err.message, true); }
      };
      $("#bkp").onclick = () => download(new Blob([JSON.stringify(S.data, null, 1)], { type: "application/json" }), `desgoises-copia-${today()}.json`);
      $("#out").onclick = async () => { await api("logout", { method: "POST" }).catch(() => {}); S.data = null; S.I = null; showLogin(); };
    },
  };
}

// Cada compra de moldería de todos los talles es un molde: se lista por el nombre que se le puso en la descripción.
const moldesCargados = () => S.data.gastos.filter((g) => g.categoria === "molderia" && !g.envio)
  .sort((a, b) => moldeNombre(S.I, a).localeCompare(moldeNombre(S.I, b), "es"));

function vMolderias() {
  const I = S.I;
  const ms = moldesCargados();
  return {
    title: "Moldería todos los talles",
    parent: "#/gestionar",
    html: `
      <p class="hint" style="margin:0 4px">Cada moldería aparece con el nombre que le pusiste en la descripción. Puede servir para uno o varios productos.</p>
      <section class="card flush"><ul class="list">
        <li><button class="row add" id="new"><span class="ico-box">${icon("plus")}</span><span class="row-main">Cargar moldería</span></button></li>
        ${ms.map((g) => {
          const envios = (I.enviosDe.get(g.id) || []).map((e) => I.partesDe.get(e.id)?.find((x) => x._ref.id === g.id)?.monto ?? 0).reduce((s, v) => s + v, 0);
          const sub = [destinoTexto(I, g) || "Sin producto", g.concepto, envios ? `+ ${money(envios, g.moneda)} de envíos` : null].filter(Boolean).join(" · ");
          return `<li><a class="row" href="#/gasto/${g.id}"><span class="ico-box">${icon("ruler")}</span>
            <span class="row-main"><span class="row-title wrap">${esc(moldeNombre(I, g))}</span><span class="row-sub wrap">${esc(sub)}</span></span>
            <span class="row-end"><b class="money">${money(g.monto, g.moneda)}</b>${faltaAsignar(g) ? '<span class="badge warn">Sin producto</span>' : ""}</span>${icon("right", "chev")}</a></li>`;
        }).join("")}</ul></section>`,
    bind() { $("#new").onclick = () => openCarga(ctx, null, { categoria: "molderia" }); },
  };
}

function vGestionarLista(k) {
  if (k === "molderia") return vMolderias();
  const L = LISTAS[k];
  if (!L) return null;
  const D = S.data, I = S.I;
  const items = (L.table ? D[L.table] : D.opciones.filter((o) => o.tipo === L.tipo));
  const act = items.filter((x) => !x.archivada), arch = items.filter((x) => x.archivada);
  const count = (x) => {
    if (L.table === "muestras") return moneyM(tot(I.gastosDeMuestra.get(x.id) || []));
    if (L.table === "colecciones") return moneyM(coleccionCosts(I, x.id).total);
    if (L.table === "campanas") return moneyM(campaignInfo(I, x.id).total);
    if (L.tipo === "suscripcion" || L.tipo === "packaging") return moneyM(tot(I.gastosDeOpcion.get(x.id) || []));
    if (L.tipo === "medio_pago") return plural(D.gastos.filter((g) => g.medio_pago === x.nombre).length, "gasto");
    return plural(D.gastos.filter((g) => g.concepto === x.nombre && (!L.cat || g.categoria === L.cat)).length, "gasto");
  };
  const row = (x) => L.link
    ? `<li><a class="row" href="${L.link(x)}">${L.table === "muestras" ? muestraThumb(x) : `<span class="ico-box">${icon(L.icon)}</span>`}<span class="row-main"><span class="row-title">${esc(x.nombre)}</span>
       ${x.producto_id ? `<span class="row-sub">Vinculada a ${esc(I.producto.get(x.producto_id)?.nombre)}</span>` : x.no_produce ? `<span class="row-sub">No se va a producir</span>` : ""}</span><span class="row-end"><b class="money">${count(x)}</b></span>${icon("right", "chev")}</a></li>`
    : `<li><button class="row" data-edit="${x.id}"><span class="ico-box">${icon(L.icon)}</span><span class="row-main"><span class="row-title">${esc(x.nombre)}</span></span><span class="row-end muted small">${count(x)}</span>${icon("pencil", "sm")}</button></li>`;
  return {
    title: L.titulo,
    parent: "#/gestionar",
    html: `
      ${L.hint ? `<p class="hint" style="margin:0 4px">${L.hint}</p>` : ""}
      <section class="card flush"><ul class="list">
        <li><button class="row add" id="new"><span class="ico-box">${icon("plus")}</span><span class="row-main">${L.nuevo}</span></button></li>
        ${act.map(row).join("")}</ul></section>
      ${arch.length ? `<details class="card" style="padding:0"><summary class="row" style="border:0">${icon("archive")}<span class="row-main">Archivados (${arch.length})</span>${icon("down", "chev")}</summary><ul class="list">${arch.map(row).join("")}</ul></details>` : ""}`,
    bind() {
      $("#new").onclick = async () => {
        if (k === "campanas") return nuevaCampana();
        const r = await promptSheet({ title: L.nuevo, label: L.label, ok: "Crear" });
        if (!r) return;
        try {
          const row = await api(L.table || "opciones", { method: "POST", body: L.table ? { nombre: r.value } : { tipo: L.tipo, nombre: r.value, orden: 50 } });
          await reload();
          toast("Creado");
          if (L.link) location.hash = L.link(row);
        } catch (err) { toast(err.message, true); }
      };
      $$("[data-edit]").forEach((b) => (b.onclick = () => editarSimple("opciones", I.opcion.get(Number(b.dataset.edit)), "opción")));
    },
  };
}

/* ================= Simulación de cobertura ================= */

const SIM = { mes: null, excluir: new Set(), incluirGrandes: new Set(), ventas: "", recupero: 12 };

function vSimular() {
  const I = S.I;
  const cob = S.data.ajustes.cobertura;
  if (!SIM.mes) { SIM.mes = cob?.mes || addMonths(thisMonth(), -1); SIM.ventas = cob?.ventas ? String(cob.ventas) : ""; }
  const items = generalesDelMes(I, SIM.mes).map((it) => ({
    ...it, incluir: it.grande ? SIM.incluirGrandes.has(it.gasto.id) : !SIM.excluir.has(it.gasto.id),
  }));
  const ventas = Number(SIM.ventas) || 0;
  const r = simularCobertura(items.filter((i) => (i.gasto.moneda || "ARS") === "ARS"), ventas, SIM.recupero);
  const hayUsd = items.some((i) => i.gasto.moneda === "USD");

  return {
    title: "Simular cobertura",
    parent: "#/gestionar",
    html: `
      <p class="hint" style="margin:0 4px">Herramienta para evaluar precios. No crea ni modifica gastos. Los gastos ya asignados a productos o campañas no entran, para no contarlos dos veces.</p>
      ${periodNav(SIM.mes, "sm", false)}
      <section class="card flush">
        ${items.length ? `<ul class="list">${items.map((it) => `<li><label class="row">
          <input type="checkbox" data-it="${it.gasto.id}" data-grande="${it.grande ? 1 : ""}" ${it.incluir ? "checked" : ""} style="width:22px;height:22px">
          <span class="row-main"><span class="row-title">${esc(gastoTitulo(I, it.gasto))}</span>
          <span class="row-sub">${esc(CAT[it.gasto.categoria].nombre)}${it.meses > 1 ? ` · 1/${it.meses} del pago del ${esc(fmtDate(it.gasto.fecha))}` : ""}${it.grande ? " · compra grande" : ""}</span></span>
          <span class="row-end"><b class="money">${money(it.grande ? it.gasto.monto / Math.max(1, SIM.recupero) : it.importe, it.gasto.moneda)}</b>${it.grande ? `<span class="row-sub">en ${SIM.recupero} meses</span>` : ""}</span></label></li>`).join("")}</ul>`
          : `<div class="empty">No hay gastos generales en ${monthName(SIM.mes)}.</div>`}
      </section>
      ${items.some((i) => i.grande) ? `<div class="field"><label for="s-rec">Recuperar compras grandes en (meses)</label><input id="s-rec" class="input" inputmode="numeric" value="${SIM.recupero}"></div>` : ""}
      <div class="field"><label for="s-v">Ventas esperadas en el mes (unidades)</label><input id="s-v" class="input" inputmode="numeric" value="${esc(SIM.ventas)}" placeholder="Ej.: 50">
        <span class="hint">Son las unidades que esperás vender, no las producidas.</span></div>
      <section class="card">
        <div class="stats" style="margin:0;padding:0;border:0">
          <div class="stat"><span>Gastos generales elegidos</span><b class="money">${money(r.total)}</b></div>
          <div class="stat"><span>A cubrir por unidad vendida</span><b class="money">${r.porUnidad != null ? money(r.porUnidad, "ARS", true) : "—"}</b></div>
        </div>
        ${hayUsd ? `<p class="hint" style="margin:12px 0 0">Los gastos en dólares no se suman a pesos. Quedan fuera del cálculo.</p>` : ""}
      </section>
      <button class="btn" id="use" ${r.porUnidad == null ? "disabled" : ""}>${icon("check")} Guardar simulación</button>
      ${cob ? `<p class="hint" style="margin:0 4px">Guardada: ${money(cob.porUnidad, "ARS", true)} por unidad (${esc(monthName(cob.mes))}, ${fmtInt(cob.ventas)} ventas).</p>` : ""}`,
    bind() {
      bindPeriod(() => SIM.mes, (p) => { SIM.mes = p; render(true); }, "sm");
      $$("[data-it]").forEach((b) => (b.onchange = () => {
        const id = Number(b.dataset.it);
        if (b.dataset.grande) b.checked ? SIM.incluirGrandes.add(id) : SIM.incluirGrandes.delete(id);
        else b.checked ? SIM.excluir.delete(id) : SIM.excluir.add(id);
        render(true);
      }));
      const v = $("#s-v");
      v.onchange = () => { SIM.ventas = v.value.replace(/\D/g, ""); render(true); };
      $("#s-rec")?.addEventListener("change", (e) => { SIM.recupero = Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 12); render(true); });
      $("#use").onclick = (e) => busy(e.currentTarget, async () => {
        await api("ajustes", { method: "PUT", body: { clave: "cobertura", valor: { porUnidad: Math.round(r.porUnidad), mes: SIM.mes, ventas, total: Math.round(r.total), fecha: today() } } });
        await reload();
        toast("Simulación guardada");
      }).catch(() => {});
    },
  };
}

/* ================= Inicio ================= */

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
start();
