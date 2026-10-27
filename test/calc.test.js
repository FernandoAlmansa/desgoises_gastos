// Casos de la especificación (punto 18). Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  index, campaignInfo, tandaCosts, coleccionCosts, pagoInfo, splitByUnits, avisos,
  generalesDelMes, simularCobertura, faltaAsignar, M, balancePeriodo, conclusionPeriodo, estampaInfo, pasoTanda, inPeriod,
} from "../public/js/calc.js";

const $ = (pesos) => pesos * 100;

function base() {
  return {
    opciones: [
      { id: 1, tipo: "concepto_prod", nombre: "Tela" }, { id: 2, tipo: "concepto_prod", nombre: "Confección" },
      { id: 3, tipo: "concepto_prod", nombre: "Lavadero" },
      { id: 10, tipo: "suscripcion", nombre: "Tienda Nube" }, { id: 11, tipo: "packaging", nombre: "Etiquetas" },
    ],
    colecciones: [{ id: 1, nombre: "Archive" }],
    productos: [
      { id: 1, nombre: "Campera zip", coleccion_id: 1 },
      { id: 2, nombre: "Crewneck negro", coleccion_id: 1 },
      { id: 3, nombre: "Crewneck blanco", coleccion_id: 1 },
    ],
    tandas: [
      { id: 1, producto_id: 1, nombre: "Primera producción", cant_estimada: 20, cant_final: null, estado: "produccion", cerrada: 0 },
      { id: 2, producto_id: 2, nombre: "Primera producción", cant_estimada: 40, cant_final: null, estado: "produccion", cerrada: 0 },
      { id: 3, producto_id: 3, nombre: "Primera producción", cant_estimada: 40, cant_final: null, estado: "produccion", cerrada: 0 },
    ],
    tandaConceptos: [],
    muestras: [{ id: 1, nombre: "Campera con capucha", producto_id: 1 }, { id: 2, nombre: "Short", producto_id: null }],
    campanas: [{ id: 1, nombre: "Archive", coleccion_id: 1 }],
    campanaTandas: [{ campana_id: 1, tanda_id: 1 }, { campana_id: 1, tanda_id: 2 }, { campana_id: 1, tanda_id: 3 }],
    gastos: [
      { id: 1, fecha: "2026-10-01", monto: $(200000), moneda: "ARS", categoria: "campanas", campana_id: 1, concepto: "Estudio" },
      { id: 2, fecha: "2026-10-02", monto: $(100000), moneda: "ARS", categoria: "campanas", campana_id: 1, concepto: "Fotógrafo" },
      { id: 3, fecha: "2026-10-03", monto: $(300000), moneda: "ARS", categoria: "produccion", producto_id: 2, tanda_id: 2, concepto: "Confección" },
      { id: 4, fecha: "2026-10-03", monto: $(500000), moneda: "ARS", categoria: "produccion", producto_id: 2, tanda_id: 2, concepto: "Tela" },
      { id: 5, fecha: "2026-09-10", monto: $(80000), moneda: "ARS", categoria: "muestras", muestra_id: 1 },
      { id: 6, fecha: "2026-09-12", monto: $(30000), moneda: "ARS", categoria: "muestras", muestra_id: 2 },
      { id: 7, fecha: "2026-10-05", monto: $(150000), moneda: "ARS", categoria: "packaging", opcion_id: 11, cantidad: 5000, en_cantidad: 1 },
      { id: 8, fecha: "2026-10-01", monto: $(30000), moneda: "ARS", categoria: "suscripciones", opcion_id: 10, cubre_meses: 1 },
      { id: 9, fecha: "2026-08-01", monto: $(120000), moneda: "ARS", categoria: "suscripciones", opcion_id: 10, cubre_meses: 12 },
    ],
    pagos: [
      { id: 1, gasto_id: 1, fecha: "2026-10-01", monto: $(200000) }, { id: 2, gasto_id: 2, fecha: "2026-10-02", monto: $(100000) },
      { id: 3, gasto_id: 3, fecha: "2026-10-03", monto: $(100000) },
    ],
    ajustes: {}, historial: [],
  };
}

test("campaña se reparte por unidades y las partes suman el total", () => {
  const I = index(base());
  const c = campaignInfo(I, 1);
  assert.equal(c.estado, "estimado");
  assert.equal(M.get(c.total), $(300000));
  assert.equal(M.get(c.asignado.get(1)), $(60000));
  assert.equal(M.get(c.asignado.get(2)), $(120000));
  assert.equal(M.get(c.asignado.get(3)), $(120000));
  const suma = [1, 2, 3].reduce((s, t) => s + M.get(c.asignado.get(t)), 0);
  assert.equal(suma, M.get(c.total));
});

test("el reparto con decimales suma exacto", () => {
  const parts = splitByUnits(100000, [1, 1, 1]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 100000);
});

test("seña y saldo: costo acordado 300.000, pagado 100.000, pendiente 200.000", () => {
  const D = base();
  const I = index(D);
  let p = pagoInfo(I, I.gasto.get(3));
  assert.deepEqual([p.acordado, p.pagado, p.pendiente, p.estado], [$(300000), $(100000), $(200000), "parcial"]);
  D.pagos.push({ id: 9, gasto_id: 3, fecha: "2026-10-20", monto: $(200000) });
  const I2 = index(D);
  p = pagoInfo(I2, I2.gasto.get(3));
  assert.equal(p.estado, "pagado");
  // Pagar el saldo no agrega costo a la tanda
  assert.equal(M.get(tandaCosts(I2, 2).lineas.produccion.total), $(800000));
});

test("cambiar cantidad estimada por final recalcula el costo unitario", () => {
  const D = base();
  let tc = tandaCosts(index(D), 2);
  assert.equal(M.get(tc.porUnidad(tc.lineas.produccion.total)), $(20000));
  assert.equal(tc.estado, "estimado");
  D.tandas[1].cant_final = 38;
  tc = tandaCosts(index(D), 2);
  assert.equal(Math.round(M.get(tc.porUnidad(tc.lineas.produccion.total))), Math.round($(800000) / 38)); // $21.052,63
  assert.equal(tc.unidades.estimada, false);
  assert.equal(D.tandas[1].cant_estimada, 40); // la estimada se conserva
});

test("cantidad desconocida no es cero: queda incompleto y la campaña pendiente", () => {
  const D = base();
  D.tandas[0].cant_estimada = null;
  const I = index(D);
  const tc = tandaCosts(I, 1);
  assert.equal(tc.unidades.n, null);
  assert.equal(tc.porUnidad({ ARS: 100 }), null);
  assert.equal(tc.estado, "incompleto");
  assert.equal(campaignInfo(I, 1).estado, "falta_cantidad");
  assert.ok(avisos(I).some((a) => a.texto.includes("reparto pendiente")));
});

test("la colección cuenta la campaña una sola vez", () => {
  const I = index(base());
  const col = coleccionCosts(I, 1);
  assert.equal(M.get(col.lineas.campana.total), $(300000));
  assert.equal(M.get(col.lineas.produccion.total), $(800000));
  assert.equal(M.get(col.lineas.desarrollo.total), $(80000)); // la muestra sin producto no entra
  assert.equal(M.get(col.total), $(1180000));
  assert.equal(M.get(col.pendiente), $(780000)); // saldo confección + tela y muestra sin pagar
});

test("desarrollo vinculado aparece en la ficha del producto", () => {
  const tc = tandaCosts(index(base()), 1);
  assert.equal(M.get(tc.lineas.desarrollo.total), $(80000));
  assert.equal(M.get(tc.lineas.campana.total), $(60000));
  assert.equal(M.get(tc.directo), $(140000));
});

test("concepto sin cargar figura pendiente, no $0", () => {
  const D = base();
  let tc = tandaCosts(index(D), 2);
  assert.deepEqual(tc.conceptosPendientes, ["Lavadero"]);
  D.tandaConceptos.push({ tanda_id: 2, concepto: "Lavadero", estado: "no_aplica" });
  tc = tandaCosts(index(D), 2);
  assert.deepEqual(tc.conceptosPendientes, []);
});

test("5.000 etiquetas quedan como gasto general y no se reparten", () => {
  const I = index(base());
  for (const t of [1, 2, 3]) assert.ok(!tandaCosts(I, t).lineas.produccion.gastos.some((g) => g.id === 7));
  assert.equal(faltaAsignar(I.gasto.get(7)), false);
});

test("Tienda Nube entra en la simulación una vez; la compra grande queda afuera por defecto", () => {
  const I = index(base());
  const items = generalesDelMes(I, "2026-10").map((it) => ({ ...it, incluir: !it.grande }));
  assert.equal(items.filter((i) => i.gasto.opcion_id === 10).length, 2); // mensual + parte del anual
  const anual = items.find((i) => i.gasto.id === 9);
  assert.equal(anual.importe, $(10000));
  const r = simularCobertura(items, 10, 12);
  assert.equal(r.total, $(40000));
  assert.equal(r.porUnidad, $(4000));
});

test("gasto importado sin categoría queda pendiente de asignar", () => {
  assert.equal(faltaAsignar({ categoria: null }), true);
  assert.equal(faltaAsignar({ categoria: "produccion", producto_id: 1 }), true);
  assert.equal(faltaAsignar({ categoria: "envios" }), false);
});

test("publicidad de una colección se reparte por unidades entre sus productos", () => {
  const D = base();
  D.gastos.push({ id: 20, fecha: "2026-10-10", monto: $(100000), moneda: "ARS", categoria: "publicidad", coleccion_id: 1 });
  const I = index(D);
  assert.equal(faltaAsignar(I.gasto.get(20)), false);
  // 20 + 40 + 40 unidades estimadas
  assert.equal(M.get(tandaCosts(I, 1).lineas.publicidad.total), $(20000));
  assert.equal(M.get(tandaCosts(I, 2).lineas.publicidad.total), $(40000));
  assert.equal(tandaCosts(I, 2).lineas.publicidad.coleccion.info.estado, "estimado");
  // En la colección se cuenta una sola vez
  assert.equal(M.get(coleccionCosts(I, 1).lineas.publicidad.total), $(100000));
});

test("rendimiento de tela: kilos comprados contra unidades", () => {
  const D = base();
  D.gastos.find((g) => g.id === 4).kg = 25; // Tela de la tanda 2 (40 u. estimadas)
  D.gastos.push({ id: 21, fecha: "2026-10-03", monto: $(50000), moneda: "ARS", categoria: "produccion", producto_id: 2, tanda_id: 2, concepto: "Tela", descripcion: "Rib", kg: 5 });
  const tela = tandaCosts(index(D), 2).tela;
  assert.equal(tela.kg, 30);
  assert.equal(tela.unidadesPorKg, 40 / 30);
  assert.equal(tela.kgPorUnidad, 0.75);
  assert.equal(tela.telas.length, 2);
  assert.equal(M.get(tela.telas.find((t) => t.nombre === "Rib").porKg), $(10000));
});

test("Publicidad a varios productos: se reparte por unidades solo entre los elegidos", () => {
  const D = base();
  D.gastos.push({ id: 20, fecha: "2026-10-10", monto: $(60000), moneda: "ARS", categoria: "publicidad", descripcion: "Instagram" });
  D.gastoTandas = [{ gasto_id: 20, tanda_id: 1 }, { gasto_id: 20, tanda_id: 2 }];
  const I = index(D);
  // 20 u. y 40 u. → 20.000 y 40.000; el tercer producto no recibe nada.
  assert.equal(M.get(tandaCosts(I, 1).lineas.publicidad.total), $(20000));
  assert.equal(M.get(tandaCosts(I, 2).lineas.publicidad.total), $(40000));
  assert.equal(M.get(tandaCosts(I, 3).lineas.publicidad.total), 0);
  assert.equal(faltaAsignar(I.gasto.get(20)), false);
  // En la colección se cuenta una sola vez.
  assert.equal(coleccionCosts(I, 1).lineas.publicidad.gastos.filter((g) => g.id === 20).length, 1);
});

test("Packaging vinculado: precio por unidad de la compra × por prenda × unidades, dentro de fabricación", () => {
  const D = base();
  // Etiquetas: $150.000 / 5.000 u. = $30 c/u; el crewneck (40 u.) lleva 2 por prenda → $2.400.
  D.productoPackaging = [{ id: 1, producto_id: 2, gasto_id: 7, por_prenda: 2 }];
  const I = index(D);
  const tc = tandaCosts(I, 2);
  assert.equal(M.get(tc.lineas.packaging.total), $(2400));
  assert.equal(M.get(tc.fabricacion), $(800000) + $(2400));
  assert.equal(M.get(tc.directo), M.get(tc.fabricacion) + M.get(tc.lineas.campana.total) + M.get(tc.lineas.publicidad.total));
});

test("Balance del mes: producir ropa, producir y vender, y gastos no asignados aparte", () => {
  const I = index(base());
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-10")));
  assert.equal(M.get(B.produccion.total), $(800000));
  assert.equal(B.produccion.grupos.length, 1);
  assert.equal(B.produccion.grupos[0].nombre, "Crewneck negro");
  assert.equal(M.get(B.producir), $(800000));
  assert.equal(M.get(B.vender), $(1100000));
  assert.deepEqual(B.noAsignados.map((x) => x.key), ["packaging", "suscripciones"]);
  assert.equal(M.get(B.totalNoAsignados), $(180000));
});

test("Muestra que no se va a producir: su gasto pasa a no asignados", () => {
  const D = base();
  D.muestras[1].no_produce = 1;
  const I = index(D);
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-09")));
  assert.equal(M.get(B.muestras.total), $(80000));
  assert.equal(B.muestras.grupos[0].nombre, "Campera con capucha");
  assert.equal(M.get(B.noAsignados.find((x) => x.key === "no_producidas").total), $(30000));
});

test("Estampa: se separa por método y la serigrafía por mí junta varias compras", () => {
  const g = (id, monto, estampa) => ({ id, fecha: "2026-10-04", monto: $(monto), moneda: "ARS", categoria: "produccion", tanda_id: 2, concepto: "Estampa", estampa });
  const est = estampaInfo([g(30, 10000, "bordado"), g(31, 5000, "serigrafia_propia"), g(32, 3000, "serigrafia_propia"), { id: 33, concepto: "Tela", monto: 1 }]);
  assert.deepEqual(est.map((x) => x.nombre), ["Bordado", "Serigrafía por mí"]);
  assert.equal(M.get(est[1].total), $(8000));
});

test("Conclusión: colección comenzada, paso de cada producto y peso de la campaña", () => {
  const D = base();
  let C = conclusionPeriodo(index(D), "2026-10");
  assert.equal(C.principal.key, "produccion");
  const archive = C.colecciones[0];
  assert.equal(archive.estado, "comenzada");
  // El crewneck negro tiene tela y confección: sigue el lavadero.
  assert.equal(archive.productos.find((p) => p.tanda.id === 2).estado, "En lavadero");
  assert.equal(Math.round(C.campanas[0].pctMes), Math.round((300000 / 1280000) * 100));

  // Sin lavadero ("no aplica") queda lista para cerrar.
  D.tandaConceptos = [{ tanda_id: 2, concepto: "Lavadero", estado: "no_aplica" }];
  assert.equal(pasoTanda(index(D), D.tandas[1], "2026-10-31").estado, "Lista para cerrar");

  // Todas las tandas revisadas y cerradas en octubre: la colección se produjo completa ese mes.
  for (const t of D.tandas) t.cerrada = 1;
  D.historial = D.tandas.map((t, i) => ({ id: i + 1, entidad: "tandas", entidad_id: t.id, fecha: "2026-10-20 12:00:00", detalle: JSON.stringify({ cerrada: [0, 1] }) }));
  C = conclusionPeriodo(index(D), "2026-10");
  assert.equal(C.colecciones[0].estado, "completa");
});
