// Estructura de la base. Se aplica sola la primera vez que el Worker recibe un pedido.
// Si más adelante cambia, subir SCHEMA_VERSION y agregar las sentencias nuevas al final de MIGRATIONS.

export const SCHEMA_VERSION = 4;

export const MIGRATIONS = {
  1: [
    `CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT)`,
    `CREATE TABLE IF NOT EXISTS opciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,              -- suscripcion | packaging | concepto_prod | concepto_campana | concepto_muestra | medio_pago
      nombre TEXT NOT NULL,
      orden INTEGER NOT NULL DEFAULT 0,
      archivada INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS colecciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      archivada INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      coleccion_id INTEGER REFERENCES colecciones(id),
      foto_id INTEGER,
      archivado INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tandas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      nombre TEXT NOT NULL,
      coleccion_id INTEGER REFERENCES colecciones(id),
      cant_estimada INTEGER,
      cant_final INTEGER,
      estado TEXT NOT NULL DEFAULT 'preparacion',   -- preparacion | produccion | finalizada
      cerrada INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS tanda_conceptos (
      tanda_id INTEGER NOT NULL REFERENCES tandas(id),
      concepto TEXT NOT NULL,
      estado TEXT NOT NULL,                        -- no_aplica
      PRIMARY KEY (tanda_id, concepto)
    )`,
    `CREATE TABLE IF NOT EXISTS muestras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      producto_id INTEGER REFERENCES productos(id),
      archivada INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS campanas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      coleccion_id INTEGER REFERENCES colecciones(id),
      archivada INTEGER NOT NULL DEFAULT 0,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS campana_tandas (
      campana_id INTEGER NOT NULL REFERENCES campanas(id),
      tanda_id INTEGER NOT NULL REFERENCES tandas(id),
      PRIMARY KEY (campana_id, tanda_id)
    )`,
    `CREATE TABLE IF NOT EXISTS gastos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      monto INTEGER NOT NULL,                      -- en centavos; es el total acordado
      moneda TEXT NOT NULL DEFAULT 'ARS',
      categoria TEXT,                              -- null = importado sin categoría
      muestra_id INTEGER REFERENCES muestras(id),
      producto_id INTEGER REFERENCES productos(id),
      tanda_id INTEGER REFERENCES tandas(id),
      campana_id INTEGER REFERENCES campanas(id),
      opcion_id INTEGER REFERENCES opciones(id),
      concepto TEXT,
      descripcion TEXT,
      medio_pago TEXT,
      proveedor TEXT,
      comprobante_id INTEGER,
      cantidad INTEGER,
      cubre_meses INTEGER,
      estimado INTEGER NOT NULL DEFAULT 0,
      en_cantidad INTEGER NOT NULL DEFAULT 0,
      notion_id TEXT UNIQUE,
      creado TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS gastos_fecha ON gastos(fecha)`,
    `CREATE TABLE IF NOT EXISTS pagos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gasto_id INTEGER NOT NULL REFERENCES gastos(id),
      fecha TEXT NOT NULL,
      monto INTEGER NOT NULL,
      medio_pago TEXT,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS pagos_gasto ON pagos(gasto_id)`,
    `CREATE TABLE IF NOT EXISTS archivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL,
      data BLOB NOT NULL,
      thumb BLOB,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entidad TEXT NOT NULL,
      entidad_id INTEGER NOT NULL,
      tanda_id INTEGER,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      detalle TEXT NOT NULL
    )`,
    // Opciones iniciales
    ...seed("suscripcion", ["Tienda Nube", "ChatGPT", "Hosting"]),
    ...seed("packaging", ["Bolsas transparentes", "Bolsas e-commerce", "Stickers", "Etiquetas", "Otros"]),
    ...seed("concepto_prod", ["Tela", "Corte", "Confección", "Estampa", "Lavadero", "Avíos"]),
    ...seed("concepto_campana", ["Estudio", "Fotógrafo", "Modelos", "Traslados", "Utilería", "Otros"]),
    ...seed("medio_pago", ["Mercado Pago", "Transferencia", "Efectivo", "Visa crédito", "Mastercard crédito", "MODO"]),
  ],
  2: [
    // Kilos de tela comprados (para el rendimiento) y publicidad cargada a una colección entera.
    `ALTER TABLE gastos ADD COLUMN kg REAL`,
    `ALTER TABLE gastos ADD COLUMN coleccion_id INTEGER REFERENCES colecciones(id)`,
    ...seed("concepto_muestra", ["Tela", "Molde", "Corte", "Confección", "Cadete"]),
  ],
  3: [
    // Foto de portada de cada colección.
    `ALTER TABLE colecciones ADD COLUMN foto_id INTEGER`,
    // Publicidad cargada a varios productos a la vez: se reparte por unidades entre esas tandas.
    `CREATE TABLE IF NOT EXISTS gasto_tandas (
      gasto_id INTEGER NOT NULL REFERENCES gastos(id),
      tanda_id INTEGER NOT NULL REFERENCES tandas(id),
      PRIMARY KEY (gasto_id, tanda_id)
    )`,
    // Packaging que lleva cada prenda: apunta a la compra (gasto) de donde sale el precio por unidad.
    `CREATE TABLE IF NOT EXISTS producto_packaging (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL REFERENCES productos(id),
      gasto_id INTEGER NOT NULL REFERENCES gastos(id),
      por_prenda REAL NOT NULL DEFAULT 1,
      creado TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  ],
  4: [
    // Foto de cada muestra y marca "no se va a producir" (su gasto pasa a ser un gasto extra de la marca).
    `ALTER TABLE muestras ADD COLUMN foto_id INTEGER`,
    `ALTER TABLE muestras ADD COLUMN no_produce INTEGER NOT NULL DEFAULT 0`,
    // Tipo de estampa: bordado | serigrafia (de un taller) | serigrafia_propia (estampada por uno) | dtf
    `ALTER TABLE gastos ADD COLUMN estampa TEXT`,
  ],
};

function seed(tipo, nombres) {
  return nombres.map((n, i) =>
    `INSERT INTO opciones (tipo, nombre, orden) SELECT '${tipo}', '${n}', ${i}
     WHERE NOT EXISTS (SELECT 1 FROM opciones WHERE tipo = '${tipo}' AND nombre = '${n}')`
  );
}
