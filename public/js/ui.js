// Utilidades de pantalla: íconos, formato, hojas, avisos y llamadas a la API.

const P = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  shirt: '<path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  percent: '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  landmark: '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
  calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
  tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  check_circle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
};

export function icon(name, cls = "") {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ""}</svg>`;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Formato ---------- */

const nf0 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SIMB = { ARS: "$", USD: "US$" };

// cents → "$ 1.234" ; con dec=true muestra centavos (para importes por unidad)
export function money(cents, moneda = "ARS", dec = false) {
  const v = (cents || 0) / 100;
  const s = dec && Math.round(v * 100) % 100 !== 0 ? nf2.format(v) : nf0.format(Math.round(v));
  return `${SIMB[moneda] || moneda} ${s}`;
}
// {ARS, USD} → "$ 1.000 + US$ 50" ; vacío → "$ 0"
export function moneyM(map, dec = false) {
  const keys = Object.keys(map || {}).filter((k) => Math.abs(map[k]) >= 0.5).sort((a) => (a === "ARS" ? -1 : 1));
  if (!keys.length) return money(0);
  return keys.map((k) => money(map[k], k, dec)).join(" + ");
}
export const fmtInt = (n) => nf0.format(n);

// Texto del usuario → centavos. Acepta "300.000", "300000", "1.234,50", "1234.5"
export function parseAmount(str) {
  let s = String(str || "").replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  else if (lastDot > -1 && s.length - lastDot - 1 === 3 && lastComma === -1) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const v = Number(s);
  return Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}
// Formatea mientras se escribe: 300000 → 300.000
export function liveFormat(input) {
  const raw = input.value;
  const hasDec = /,\d{0,2}$/.test(raw);
  const [ent, dec] = raw.split(",");
  const digits = ent.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const fmt = digits ? nf0.format(Number(digits)) : "";
  input.value = hasDec ? `${fmt},${(dec || "").replace(/\D/g, "").slice(0, 2)}` : fmt;
}
export const centsToInput = (c) => (c == null ? "" : nf0.format(Math.floor(c / 100)) + (c % 100 ? "," + String(c % 100).padStart(2, "0") : ""));

// Kilos: "12,5" o "12.5" → 12.5 ; 12.5 → "12,5"
export function parseKg(str) {
  let s = String(str || "").replace(/[^\d.,]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const v = Number(s);
  return s && Number.isFinite(v) && v > 0 ? v : null;
}
export const fmtKg = (n, dec = 2) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: dec }).format(n);

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const today = () => new Date().toLocaleDateString("sv-SE");
export const thisMonth = () => today().slice(0, 7);
export const monthName = (key) => `${MESES[+key.slice(5, 7) - 1]} ${key.slice(0, 4)}`;
export const fmtDate = (iso, year = true) => {
  if (!iso) return "";
  const y = iso.slice(0, 4), cur = String(new Date().getFullYear());
  return `${+iso.slice(8, 10)} ${MES_C[+iso.slice(5, 7) - 1]}${year && y !== cur ? " " + y : ""}`;
};
export const fmtDateLong = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
};
export const plural = (n, s, p) => `${fmtInt(n)} ${n === 1 ? s : p || s + "s"}`;

/* ---------- API ---------- */

export class AuthError extends Error {}
export async function api(path, { method = "GET", body, form } = {}) {
  const opts = { method, headers: {}, credentials: "same-origin" };
  if (form) opts.body = form;
  else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers["Content-Type"] = "application/json"; }
  let res;
  try { res = await fetch("/api/" + path, opts); }
  catch { throw new Error("Sin conexión. Revisá internet y probá de nuevo."); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "login") throw new AuthError(data.error || "Sesión vencida");
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/* ---------- Hojas y avisos ---------- */

let toastTimer;
export function toast(msg, isError = false) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.setAttribute("role", isError ? "alert" : "status");
  el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), isError ? 4500 : 2400);
}

// Hoja inferior. render(body, close) llena el contenido. Devuelve close().
export function sheet({ title, full = false, render, foot, onClose }) {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `
    ${full ? "" : '<div class="sheet-scrim"></div>'}
    <div class="sheet ${full ? "full" : ""}" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
      <div class="sheet-head"><h2 id="sheet-t">${esc(title)}</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">${icon("x")}</button></div>
      <div class="sheet-body ${full ? "full-w" : ""}"></div>
      ${foot ? '<div class="sheet-foot"><div></div></div>' : ""}
    </div>`;
  const prevFocus = document.activeElement;
  document.body.appendChild(wrap);
  document.body.style.overflow = "hidden";
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    wrap.remove();
    if (!document.querySelector(".sheet-wrap")) document.body.style.overflow = "";
    window.removeEventListener("keydown", onKey);
    prevFocus?.focus?.();
    onClose?.();
  };
  const onKey = (e) => { if (e.key === "Escape" && wrap === [...document.querySelectorAll(".sheet-wrap")].pop()) close(); };
  window.addEventListener("keydown", onKey);
  wrap.querySelector("[data-close]").onclick = close;
  wrap.querySelector(".sheet-scrim")?.addEventListener("click", close);
  const body = wrap.querySelector(".sheet-body");
  const footEl = wrap.querySelector(".sheet-foot > div");
  const api = { body, foot: footEl, close, setTitle: (t) => (wrap.querySelector("#sheet-t").textContent = t), el: wrap };
  render(api);
  return api;
}

export function confirmSheet({ title, text, ok = "Confirmar", danger = false }) {
  return new Promise((resolve) => {
    let answered = false;
    sheet({
      title,
      onClose: () => { if (!answered) resolve(false); },
      render: ({ body, close }) => {
        body.innerHTML = `<div class="small">${text}</div>
          <div class="btn-row"><button class="btn secondary" data-no>Cancelar</button>
          <button class="btn ${danger ? "danger" : ""}" data-yes>${esc(ok)}</button></div>`;
        body.querySelector("[data-no]").onclick = () => { answered = true; resolve(false); close(); };
        body.querySelector("[data-yes]").onclick = () => { answered = true; resolve(true); close(); };
        body.querySelector("[data-yes]").focus();
      },
    });
  });
}

// Pide un texto (y opcionalmente una colección). Devuelve null si se cancela.
export function promptSheet({ title, label, value = "", ok = "Guardar", extra = "" }) {
  return new Promise((resolve) => {
    let done = false;
    sheet({
      title,
      onClose: () => { if (!done) resolve(null); },
      render: ({ body, close }) => {
        body.innerHTML = `<form class="stack">
          <div class="field"><label for="pr-in">${esc(label)}</label>
          <input id="pr-in" class="input" value="${esc(value)}" autocomplete="off" required></div>
          ${extra}
          <button class="btn block">${esc(ok)}</button></form>`;
        const f = body.querySelector("form");
        f.onsubmit = (e) => {
          e.preventDefault();
          const v = f.querySelector("#pr-in").value.trim();
          if (!v) return;
          done = true;
          resolve({ value: v, form: f });
          close();
        };
        setTimeout(() => f.querySelector("#pr-in").focus(), 50);
      },
    });
  });
}

// Botón con estado de carga mientras corre la acción
export async function busy(btn, fn) {
  if (btn.disabled) return;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spin" aria-hidden="true"></span><span class="sr-only">Guardando…</span>';
  try { return await fn(); }
  catch (err) { toast(err.message, true); throw err; }
  finally { btn.disabled = false; btn.innerHTML = html; }
}

/* ---------- Imágenes ---------- */

// Reduce la foto en el teléfono antes de subirla (más rápido y entra en la base).
export async function resizeImage(file, max, quality = 0.82) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error("No se pudo leer la imagen");
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", quality));
}

export async function uploadFile(file, { photo = false } = {}) {
  const form = new FormData();
  if (file.type.startsWith("image/")) {
    form.append("file", await resizeImage(file, photo ? 1200 : 1600), "foto.jpg");
    form.append("thumb", await resizeImage(file, 240, 0.75), "thumb.jpg");
  } else {
    form.append("file", file, file.name);
  }
  return api("archivos", { method: "POST", form });
}

// Encuadre cuadrado antes de subir una foto: se arrastra para centrarla y se acerca con dos dedos o con la barra.
// Devuelve la foto recortada (File) o null si se cancela.
export function cropSquare(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    let done = false;
    sheet({
      title: "Encuadrar foto",
      full: true,
      foot: true,
      onClose: () => { URL.revokeObjectURL(url); if (!done) resolve(null); },
      render: ({ body, foot, close }) => {
        body.innerHTML = `<p class="hint" style="margin:0">Arrastrá la foto para centrarla. Para acercar, usá dos dedos o la barra.</p>
          <div class="crop" id="cr"><img id="cr-img" alt="Foto para encuadrar" draggable="false"></div>
          <div class="field"><label for="cr-z">Acercar</label><input id="cr-z" class="range" type="range" min="1" max="4" step="0.01" value="1"></div>`;
        foot.innerHTML = `<div class="btn-row"><button class="btn secondary" data-no>Cancelar</button><button class="btn" data-ok disabled>${icon("check")} Usar foto</button></div>`;
        const box = body.querySelector("#cr"), img = body.querySelector("#cr-img"), zoom = body.querySelector("#cr-z");
        const ok = foot.querySelector("[data-ok]");
        let W = 0, H = 0, base = 1, z = 1, x = 0, y = 0; // x, y: corrimiento del centro de la foto, en px de pantalla
        const F = () => box.clientWidth;
        const draw = () => {
          const s = base * z, mx = Math.max(0, (W * s - F()) / 2), my = Math.max(0, (H * s - F()) / 2);
          x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
          img.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${z})`;
        };
        const setZoom = (nz) => { const k = Math.min(4, Math.max(1, nz)); x *= k / z; y *= k / z; z = k; zoom.value = String(z); draw(); };
        img.onload = () => {
          W = img.naturalWidth; H = img.naturalHeight;
          base = F() / Math.min(W, H); // la foto siempre cubre todo el cuadrado
          img.style.width = `${W * base}px`; img.style.height = `${H * base}px`;
          ok.disabled = false;
          draw();
        };
        img.onerror = () => { toast("No se pudo leer la foto", true); close(); };
        img.src = url;
        zoom.oninput = () => setZoom(Number(zoom.value));

        // Arrastrar con un dedo; con dos, acercar o alejar.
        const pts = new Map();
        let last = null;
        const gesto = () => {
          const [a, b] = [...pts.values()];
          return b ? { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) } : { cx: a.x, cy: a.y, d: 0 };
        };
        box.onpointerdown = (e) => { box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = gesto(); };
        box.onpointermove = (e) => {
          if (!pts.has(e.pointerId)) return;
          pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const g = gesto();
          x += g.cx - last.cx; y += g.cy - last.cy;
          if (g.d && last.d) setZoom(z * (g.d / last.d)); else draw();
          last = g;
        };
        box.onpointerup = box.onpointercancel = (e) => { pts.delete(e.pointerId); last = pts.size ? gesto() : null; };

        foot.querySelector("[data-no]").onclick = close;
        ok.onclick = () => {
          const s = base * z, lado = F() / s;
          const sx = W / 2 - x / s - lado / 2, sy = H / 2 - y / s - lado / 2;
          const out = Math.min(1200, Math.round(lado));
          const c = document.createElement("canvas");
          c.width = c.height = out;
          c.getContext("2d").drawImage(img, sx, sy, lado, lado, 0, 0, out, out);
          c.toBlob((blob) => {
            if (!blob) return toast("No se pudo recortar la foto", true);
            done = true;
            resolve(new File([blob], "foto.jpg", { type: "image/jpeg" }));
            close();
          }, "image/jpeg", 0.9);
        };
      },
    });
  });
}

export const fileUrl = (id, thumb = false) => `/api/archivos/${id}${thumb ? "?thumb=1" : ""}`;
