// Casos de la especificación (punto 18). Correr con: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  index, campaignInfo, tandaCosts, coleccionCosts, pagoInfo, splitByUnits, avisos,
  generalesDelMes, simularCobertura, faltaAsignar, M, balancePeriodo, conclusionPeriodo, estampaInfo, pasoTanda, inPeriod,
  estadoProduccion, costoFabricacion, repartoInfo, conversionProducto, productoBalance, simulacionCostos, partesReparto,
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
  assert.equal(faltaAsignar({ categoria: "posventa" }), false);
});

test("publicidad de una colección se reparte por unidades entre sus productos", () => {
  const D = base();
  D.gastos.push({ id: 20, fecha: "2026-10-10", monto: $(100000), moneda: "ARS", categoria: "publicidad", coleccion_id: 1 });
  const I = index(D);
  assert.equal(faltaAsignar(I.gasto.get(20)), false);
  // 20 + 40 + 40 unidades estimadas
  assert.equal(M.get(tandaCosts(I, 1).lineas.publicidad.total), $(20000));
  assert.equal(M.get(tandaCosts(I, 2).lineas.publicidad.total), $(40000));
  assert.equal(repartoInfo(I, I.gasto.get(20)).estado, "estimado");
  assert.equal(tandaCosts(I, 2).lineas.publicidad.gastos[0].publi_tipo ?? "visibilidad", "visibilidad");
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
  // En la colección se cuenta una sola vez: sus partes suman el gasto entero.
  assert.equal(coleccionCosts(I, 1).lineas.publicidad.gastos.filter((g) => g.id === 20).reduce((s, g) => s + g.monto, 0), $(60000));
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

test("Moldería de todos los talles para varios productos: se reparte por unidades de la primera tanda", () => {
  const D = base();
  // Campera 20 u. y crewneck negro 40 u.: $90.000 → $30.000 y $60.000 ($1.500 por unidad en los dos).
  D.gastos.push({ id: 40, fecha: "2026-10-06", monto: $(90000), moneda: "ARS", categoria: "molderia", descripcion: "Moldes buzos" });
  D.gastoTandas = [{ gasto_id: 40, tanda_id: 1 }, { gasto_id: 40, tanda_id: 2 }];
  const I = index(D);
  assert.equal(M.get(tandaCosts(I, 1).lineas.molderia.total), $(30000));
  assert.equal(M.get(tandaCosts(I, 2).lineas.molderia.total), $(60000));
  assert.equal(tandaCosts(I, 2).lineas.publicidad.gastos.length, 0); // no se confunde con publicidad
  assert.equal(faltaAsignar(I.gasto.get(40)), false);
  // En la colección y en el Resumen se cuenta una sola vez y entera.
  assert.equal(M.get(coleccionCosts(I, 1).lineas.molderia.total), $(90000));
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-10")));
  assert.equal(M.get(B.molderia.total), $(90000));
  assert.equal(B.molderia.grupos[0].nombre, "Moldes buzos");
});

test("Envío de varias telas: se reparte según lo que costó cada una y suma en Producción", () => {
  const D = base();
  // Tela del crewneck negro $500.000 (gasto 4) y otra del blanco $100.000: el expreso de $12.000 → $10.000 y $2.000.
  D.gastos.push({ id: 41, fecha: "2026-10-07", monto: $(100000), moneda: "ARS", categoria: "produccion", producto_id: 3, tanda_id: 3, concepto: "Tela" });
  D.gastos.push({ id: 42, fecha: "2026-10-08", monto: $(12000), moneda: "ARS", categoria: "produccion", concepto: "Tela", envio: "expreso" });
  D.gastoVinculos = [{ gasto_id: 42, ref_id: 4 }, { gasto_id: 42, ref_id: 41 }];
  const I = index(D);
  assert.equal(M.get(tandaCosts(I, 2).lineas.produccion.total), $(810000));
  assert.equal(M.get(tandaCosts(I, 3).lineas.produccion.total), $(102000));
  assert.equal(faltaAsignar(I.gasto.get(42)), false);
  // En la colección y en el Resumen el envío suma una sola vez, por su total.
  assert.equal(M.get(coleccionCosts(I, 1).lineas.produccion.total), $(912000));
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-10")));
  assert.equal(M.get(B.produccion.total), $(912000));
  assert.equal(M.get(B.produccion.grupos.find((x) => x.nombre === "Crewneck blanco").total), $(102000));
});

test("Estado de la producción: preparación hasta la primera tela, después producción, y finalizada al cerrar", () => {
  const D = base();
  let I = index(D);
  assert.equal(estadoProduccion(I, D.tandas[0]), "preparacion"); // campera: sin gastos de producción
  assert.equal(estadoProduccion(I, D.tandas[1]), "produccion"); // crewneck negro: ya compró tela
  D.tandas[1].cerrada = 1;
  I = index(D);
  assert.equal(estadoProduccion(I, D.tandas[1]), "finalizada");
});

test("Prendas entregadas como parte de pago: suman su costo de fabricación a la campaña y se reparten", () => {
  const D = base();
  // Crewneck negro: $800.000 de producción / 40 u. = $20.000 c/u. Se entregan 3 → la campaña pasa de $300.000 a $360.000.
  D.campanaPrendas = [{ id: 1, campana_id: 1, producto_id: 2, tanda_id: 2, cantidad: 3 }];
  const I = index(D);
  assert.equal(M.get(costoFabricacion(I, D.tandas[1]).porUnidad), $(20000));
  const c = campaignInfo(I, 1);
  assert.equal(M.get(c.totalPrendas), $(60000));
  assert.equal(M.get(c.total), $(360000));
  // El crewneck negro (40 de 100 u.) lleva $120.000 de gastos y $24.000 de prendas.
  const tc = tandaCosts(I, 2);
  assert.equal(M.get(tc.lineas.campana.total), $(120000));
  assert.equal(M.get(tc.lineas.prendas.total), $(24000));
  // En la colección se muestran, pero no se vuelven a sumar al costo total.
  const col = coleccionCosts(I, 1);
  assert.equal(M.get(col.lineas.prendas.total), $(60000));
  assert.equal(M.get(col.total), M.get(coleccionCosts(index(base()), 1).total));
});

test("Publicidad de conversión: se reparte por lo vendido y el costo por venta es el promedio ponderado", () => {
  const D = base();
  // 150.000 con 10 ventas de la campera y 20 del crewneck negro → 50.000 y 100.000 (5.000 por venta).
  D.gastos.push({ id: 50, fecha: "2026-10-14", monto: $(150000), moneda: "ARS", categoria: "publicidad", publi_tipo: "conversion" });
  // Segunda carga, solo la campera: 18.000 con 2 ventas (9.000 por venta).
  D.gastos.push({ id: 51, fecha: "2026-10-28", monto: $(18000), moneda: "ARS", categoria: "publicidad", publi_tipo: "conversion", producto_id: 1, tanda_id: 1 });
  D.gastoTandas = [{ gasto_id: 50, tanda_id: 1, ventas: 10 }, { gasto_id: 50, tanda_id: 2, ventas: 20 }, { gasto_id: 51, tanda_id: 1, ventas: 2 }];
  const I = index(D);
  const tc1 = tandaCosts(I, 1);
  assert.equal(M.get(tc1.lineas.publicidad.conversion.total), $(68000));
  // Ponderado: (50.000 + 18.000) ÷ 12 ventas = 5.666,67 (no el promedio simple de 5.000 y 9.000).
  assert.equal(Math.round(M.get(conversionProducto(I, 1).porVenta)), Math.round($(68000) / 12));
  assert.equal(M.get(tandaCosts(I, 2).lineas.publicidad.conversion.total), $(100000));
  // El costo directo por unidad suma el costo por venta, no lo gastado ÷ unidades producidas.
  const sinConv = M.get(tc1.directo) - $(68000);
  assert.equal(Math.round(M.get(tc1.directoUnit)), Math.round(sinConv / 20 + $(68000) / 12));
  // En el Resumen se ve por tipo y por producto.
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-10")));
  const conv = B.publicidad.tipos.find((x) => x.key === "conversion");
  assert.equal(M.get(conv.total), $(168000));
  assert.deepEqual(conv.grupos.map((x) => [x.nombre, M.get(x.total)]), [["Crewneck negro", $(100000)], ["Campera zip", $(68000)]]);
});

test("Conversión sin ventas: la plata se reparte por unidades y sube el costo por venta", () => {
  const D = base();
  D.gastos.push({ id: 50, fecha: "2026-10-14", monto: $(60000), moneda: "ARS", categoria: "publicidad", publi_tipo: "conversion" });
  D.gastos.push({ id: 51, fecha: "2026-10-20", monto: $(10000), moneda: "ARS", categoria: "publicidad", publi_tipo: "conversion", producto_id: 1, tanda_id: 1 });
  D.gastoTandas = [{ gasto_id: 50, tanda_id: 1, ventas: 0 }, { gasto_id: 50, tanda_id: 2, ventas: 0 }, { gasto_id: 51, tanda_id: 1, ventas: 5 }];
  const I = index(D);
  assert.equal(repartoInfo(I, I.gasto.get(50)).sinVentas, true);
  // 60.000 por unidades (20 y 40) → la campera se lleva 20.000; con las 5 ventas de la otra carga: 30.000 ÷ 5.
  assert.equal(M.get(conversionProducto(I, 1).porVenta), $(6000));
});

test("Producción para varios productos: se reparte por unidades; los avíos, por lo que lleva cada prenda", () => {
  const D = base();
  // Serigrafía por mí para la campera (20 u.) y el crewneck negro (40 u.).
  D.gastos.push({ id: 60, fecha: "2026-10-08", monto: $(30000), moneda: "ARS", categoria: "produccion", concepto: "Estampa", estampa: "serigrafia_propia" });
  // 100 avíos por 50.000: la campera lleva 2 por prenda (40) y el crewneck 1 (40) → mitad y mitad.
  D.gastos.push({ id: 61, fecha: "2026-10-08", monto: $(50000), moneda: "ARS", categoria: "produccion", concepto: "Avíos", cantidad: 100 });
  D.gastoTandas = [{ gasto_id: 60, tanda_id: 1 }, { gasto_id: 60, tanda_id: 2 },
    { gasto_id: 61, tanda_id: 1, por_prenda: 2 }, { gasto_id: 61, tanda_id: 2, por_prenda: 1 }];
  const I = index(D);
  const p1 = tandaCosts(I, 1).lineas.produccion.gastos;
  assert.equal(p1.find((g) => g.id === 60).monto, $(10000));
  assert.equal(p1.find((g) => g.id === 61).monto, $(25000));
  assert.equal(faltaAsignar(I.gasto.get(60)), false);
  // En el Resumen la producción se ve por producto, y suma el gasto entero.
  const B = balancePeriodo(I, I.D.gastos.filter((g) => inPeriod(g.fecha, "2026-10")));
  assert.equal(M.get(B.produccion.total), $(880000));
  assert.ok(B.produccion.grupos.some((x) => x.nombre === "Campera zip"));
  assert.equal(M.get(coleccionCosts(I, 1).lineas.produccion.total), $(880000));
});

test("Balance general del producto: suma todas las tandas y el desarrollo una sola vez", () => {
  const D = base();
  D.tandas.push({ id: 4, producto_id: 2, nombre: "Restock 1", cant_estimada: null, cant_final: 20, cerrada: 0 });
  D.gastos.push({ id: 70, fecha: "2026-10-20", monto: $(200000), moneda: "ARS", categoria: "produccion", producto_id: 2, tanda_id: 4, concepto: "Tela" });
  const I = index(D);
  const b = productoBalance(I, 2);
  assert.equal(b.unidades.n, 60);
  assert.equal(M.get(b.lineas.produccion.total), $(1000000));
  assert.equal(M.get(b.directo), M.get(tandaCosts(I, 2).directo) + M.get(tandaCosts(I, 4).directo));
});

test("Simulación: unitarios que se mantienen, fijos que se dividen y el contador de avíos", () => {
  const D = base();
  D.tandas[1].cant_final = 20; D.tandas[1].cant_estimada = null;          // crewneck negro: 20 u. reales
  D.gastos.find((g) => g.id === 4).kg = 10;                              // tela 500.000 / 10 kg = 50.000 el kg
  D.gastos.push({ id: 80, fecha: "2026-10-08", monto: $(10000), moneda: "ARS", categoria: "produccion", tanda_id: 2, concepto: "Estampa", estampa: "serigrafia_propia" });
  D.gastos.push({ id: 81, fecha: "2026-10-08", monto: $(20000), moneda: "ARS", categoria: "produccion", tanda_id: 2, concepto: "Avíos", cantidad: 100 });
  D.gastoTandas = [{ gasto_id: 81, tanda_id: 2, por_prenda: 2 }];
  const I = index(D);
  const s = simulacionCostos(I, 2, { unidades: 100, cambios: {} });
  const it = (k) => s.items.find((x) => x.key === k);
  // Tela: 0,5 kg por prenda × 50.000 = 25.000 por unidad, igual que antes.
  assert.equal(M.get(it("tela:tela").unitSim), $(25000));
  // Confección: 300.000 / 20 = 15.000 por unidad, igual.
  assert.equal(M.get(it("conc:confección").unitSim), $(15000));
  // Serigrafía por mí: 10.000 fijos ÷ 100 u.
  assert.equal(M.get(it("estampa:serigrafia_propia").unitSim), $(100));
  // Avíos: 100 u. × 2 = 200 avíos > 100 comprados → cada prenda paga 2 × 200 = 400.
  assert.equal(M.get(it("avio:81").unitSim), $(400));
  assert.equal(it("avio:81").sinDesperdicioDesde, 50);
  // Con 30 u. todavía alcanza la compra: 20.000 ÷ 30.
  assert.equal(Math.round(M.get(simulacionCostos(I, 2, { unidades: 30 }).items.find((x) => x.key === "avio:81").unitSim)), Math.round($(20000) / 30));
  // La campaña (fija) se divide por las unidades nuevas.
  assert.equal(Math.round(M.get(s.lineas.campana.unit)), Math.round(M.get(tandaCosts(I, 2).lineas.campana.total) / 100));
  // Cambiar el precio del kilo de tela.
  const s2 = simulacionCostos(I, 2, { unidades: 100, cambios: { "tela:tela": { precioKg: $(40000), nombre: "Frisa otro proveedor" } } });
  const t2 = s2.items.find((x) => x.key === "tela:tela");
  assert.equal(M.get(t2.unitSim), $(20000));
  assert.equal(t2.nombre, "Frisa otro proveedor");
  assert.equal(t2.modificado, true);
});

test("Período personalizado: del día al día", () => {
  assert.equal(inPeriod("2026-10-05", "2026-10-01..2026-10-15"), true);
  assert.equal(inPeriod("2026-10-16", "2026-10-01..2026-10-15"), false);
  assert.equal(inPeriod("2026-09-30", "2026-09-20..2026-10-02"), true);
});
