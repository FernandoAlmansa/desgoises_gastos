# Des Goises · Gastos y costos

App para cargar gastos desde el celular en pocos toques y ver cuánto cuesta cada producto, colección y campaña.

- **Cargar un gasto:** botón **+** → importe → categoría → elegir (muestra, producto, campaña, servicio o insumo) → guardar.
  Si lo que buscás no existe, se crea ahí mismo, sin perder el importe ingresado, y queda guardado para la próxima vez.
- **Resumen:** cuánto se gastó y se pagó en el mes, qué falta completar, producciones activas y gastos por categoría.
- **Productos:** foto, tandas (primera producción y restocks), cantidades estimadas y finales, y costo por unidad en tres niveles.
- **Colecciones y campañas:** total directo sin contar nada dos veces; el gasto de cada campaña se reparte por unidades.
- **Movimientos:** todos los gastos, con filtros y exportación a CSV. Cada gasto se puede abrir, corregir o completar con su saldo.

---

## Qué cambió y por qué

| Antes | Ahora |
|---|---|
| Los gastos se cargaban con un atajo de iPhone en una base de Notion. | Se cargan desde la app, que se instala como ícono en la pantalla de inicio del iPhone. |
| Notion solo guardaba importe, categoría y medio de pago. | La app guarda muestras, productos, tandas, campañas, señas, cantidades y fotos, y calcula los costos. |
| La página estaba en GitHub Pages y leía Notion a través de Cloudflare. | Todo queda en Cloudflare: la app, los datos y las fotos, en el mismo lugar y en el plan gratis. |

El atajo de iPhone ya no hace falta y se puede borrar. Los gastos viejos de Notion se pueden traer con un botón (ver paso 4).

---

## Puesta en marcha (una sola vez, unos 10 minutos)

Se hace desde la Mac donde está esta carpeta. No hace falta crear cuentas nuevas: se usa la misma cuenta de Cloudflare que ya tiene el Worker `gastos-desgoises`.

### 1. Abrir la Terminal en esta carpeta

En Finder, clic derecho sobre la carpeta `desgoises_gastos` → **Nuevo terminal en la carpeta**.

### 2. Instalar y entrar a Cloudflare

```bash
npm install
```

```bash
npx wrangler login
```

Se abre el navegador para autorizar a Wrangler (la herramienta de Cloudflare) en tu cuenta. Aceptá y volvé a la Terminal.

### 3. Publicar

```bash
npx wrangler deploy
```

La primera vez, este paso:

- crea la base de datos `desgoises-gastos` (sola, sin configurar nada);
- reemplaza el Worker viejo por la app nueva, **en la misma dirección de siempre**:
  `https://gastos-desgoises.fernando-almansa.workers.dev`;
- conserva las claves que ya estaban cargadas (la clave de acceso y la conexión con Notion).

Si Wrangler pregunta si querés reemplazar el Worker que fue editado desde el panel de Cloudflare, respondé que sí.
Cuando termina, abrí esa dirección. Las tablas se crean solas en la primera visita.

**Clave para entrar:** es la misma clave que usaba el dashboard anterior (`DASH_KEY`). Para poner una nueva:

```bash
npx wrangler secret put APP_KEY
```

### 4. Traer los gastos de Notion (opcional, una vez)

En la app: **Gestionar** (ícono arriba a la derecha) → **Importar gastos de Notion**.

- Trae todos los gastos con su fecha, importe, categoría y medio de pago, marcados como pagados.
- Los que necesitan muestra, producto o campaña quedan como **pendientes de asignar**: aparecen en el Resumen y se completan tocando cada uno → **Editar**.
- Si se aprieta dos veces, no duplica nada.
- “Contenido y campañas” pasa a “Campañas de contenido de colecciones”, y “Publicidad y difusión” a “Publicidad”. Lo que estaba en “Otros” queda sin categoría para elegirla.

### 5. Instalar en el iPhone

1. Abrí `https://gastos-desgoises.fernando-almansa.workers.dev` en **Safari**.
2. Ingresá la clave (se pide una sola vez por teléfono).
3. Tocá **Compartir** → **Agregar a pantalla de inicio**.

Queda un ícono “DG Gastos” que abre la app a pantalla completa, como una app más. Se puede instalar igual en todos los teléfonos que necesiten cargar gastos.

### 6. Desactivar la página vieja de GitHub (opcional)

El link viejo de GitHub Pages (`fernandoalmansa.github.io/desgoises_gastos`) ahora redirige a la app nueva, así que no se rompe nada.
Si preferís apagarlo: GitHub → repositorio → **Settings → Pages → Unpublish site**.

---

## Para actualizar la app más adelante

Cada vez que haya cambios en esta carpeta:

```bash
npx wrangler deploy
```

Los datos no se tocan al publicar.

**Opción automática (recomendada si subís los archivos por GitHub):** en Cloudflare → **Workers & Pages → gastos-desgoises → Settings → Builds → Connect**, elegí el repositorio `desgoises_gastos`, rama `main`, y dejá como comando de deploy `npx wrangler deploy`. Desde ese momento, cada vez que subas archivos al repositorio la app se actualiza sola.

## Copias de seguridad

- **Desde la app:** Gestionar → **Descargar copia de seguridad** (un archivo con todos los datos).
- **Automática:** Cloudflare guarda el historial de la base de los últimos 7 días (30 con el plan pago). Para volver a un momento anterior:

```bash
npx wrangler d1 time-travel restore desgoises-gastos --timestamp=2026-10-25T12:00:00Z
```

## Costos

Todo entra en el plan gratis de Cloudflare: 100.000 pedidos por día y una base de hasta 500 MB. Los gastos ocupan muy poco (cientos de miles entran holgados); lo que más pesa son las fotos y comprobantes, que se achican en el teléfono antes de subirse (unos 150–250 KB cada uno): entran unos 2.000. Si algún día se llena, el plan pago de Workers (USD 5 por mes) lleva la base a 10 GB.

## Probar en la computadora sin publicar

```bash
npm run dev
```

Abre la app en `http://localhost:8787` con datos de prueba separados. La clave local está en el archivo `.dev.vars` (`APP_KEY=prueba`).

```bash
npm test
```

Verifica los cálculos con los casos de la especificación (reparto de campaña, seña y saldo, cantidad estimada → final, etc.).

---

## Cómo calcula

- **Pagos parciales:** un gasto guarda el **costo acordado**; la seña y el saldo son **pagos** de ese gasto. Pagar el saldo no suma costo.
- **Cantidades:** se usa la cantidad final si está; si no, la estimada (marcado como *estimado*). Sin cantidad no se calcula costo por unidad: dice “Falta cargar cantidad”.
- **Campañas:** gasto asignado a cada producto = gasto de la campaña × unidades del producto ÷ unidades totales participantes. Las partes siempre suman el total exacto. En la colección, la campaña se cuenta una sola vez.
- **Desarrollo (muestras vinculadas y moldería):** se cuenta una sola vez, en la **primera tanda** del producto. Los restocks muestran “En Primera producción”.
- **Publicidad:** se carga a un producto o a una **colección entera**. La de colección se reparte igual que una campaña: gasto × unidades del producto ÷ unidades de todos los productos de la colección.
- **Conceptos de producción** (tela, corte, confección, estampa, lavadero, avíos): los que no tienen gasto figuran **pendientes**, no $0, hasta que se cargan o se marcan “No aplica”. Las **muestras** tienen sus propios conceptos (tela, molde, corte, confección, cadete).
- **Rendimiento de tela:** al cargar un gasto con concepto Tela se anotan los **kg**. En la ficha del producto: unidades por kg = unidades ÷ kg de tela de la tanda, y el consumo por prenda (kg ÷ unidades), en total y por cada tela.
- **Gastos generales** (suscripciones, envíos, equipamiento, comisiones, administración, packaging): no se reparten entre productos. Equipamiento se muestra aparte.
- **Suscripciones:** se guarda el pago y el período que cubre. En la simulación, un pago anual se reparte en 12 meses.
- **Simular cobertura de gastos generales** (Gestionar): elegís los gastos de un mes y las ventas esperadas, y te dice cuánto debería cubrir cada venta. No modifica ningún gasto. Ese valor se suma como tercer nivel de costo en cada producto.
- **Monedas:** pesos y dólares nunca se suman entre sí; se muestran por separado.
- **Tanda cerrada:** al marcarla “revisada y cerrada” avisa si falta algo; después no se puede modificar hasta reabrirla. Los cambios de cantidades y gastos quedan en el historial de la tanda.

La app no muestra caja, ganancias ni stock: para eso harían falta ventas, cobros y saldos, que todavía no se registran.

## Estructura del proyecto

```
public/            la app (se instala en el teléfono)
  js/app.js        pantallas
  js/carga.js      carga y edición de gastos
  js/calc.js       cálculos (repartos, costos, avisos)
  js/ui.js         formato, íconos y utilidades
src/worker.js      servidor: guarda y lee los datos
src/schema.js      estructura de la base de datos
test/              verificación de los cálculos
wrangler.jsonc     configuración de Cloudflare
```
