# Registro de cambios

Todo lo que cambia en la app queda anotado acá, del más nuevo al más viejo.
Sirve para retomar el trabajo desde cualquier computadora (y para que Claude sepa qué se hizo antes).

Cada entrada dice **qué cambió para quien usa la app**, **por qué**, y al final las **notas técnicas** (archivos, base de datos) cuando hacen falta.

---

## Estado actual

- **Publicado en Cloudflare:** sin confirmar. Los cambios del 25 y 26/10 se publican con `npx wrangler deploy` desde la carpeta del proyecto.
- **Versión de la base de datos:** v3 (foto de colección, publicidad a varios productos, packaging vinculado). Se actualiza sola en la primera visita después de publicar.
- **Pendientes / dudas abiertas:**
  - Confirmar que la 3.ª categoría es **Moldería** (salió de un audio que decía "mueblería / mordería").
  - El packaging vinculado se suma en el producto, pero **no** en el total de la colección (allá se suman gastos, y la compra de packaging es un gasto general). Revisar si se quiere ver también en la colección.
  - Si una publicidad se reparte entre productos de **colecciones distintas**, en cada colección se cuenta el gasto entero (no solo su parte).

---

## 2026-10-26 — Pedido con capturas: Resumen, Colecciones, ficha del producto y packaging

**Qué cambió**
- **Resumen**
  - Las categorías van en el mismo orden que al cargar un gasto.
  - Debajo de cada categoría se listan sus gastos en filas finas (nombre que le pusiste y monto). Se ven los 5 más nuevos y un link "Ver los N" si hay más.
  - Packaging y presentación sale de la lista y va aparte, debajo de Equipamiento (el total de arriba dice cuánto incluye de cada uno).
  - "Para completar" solo aparece cuando hay algo para completar: cantidades que faltan, repartos de campañas o publicidad pendientes, gastos sin asignar, saldos de pagos parciales o posibles duplicados. Si está todo bien, no se muestra.
- **Colecciones**
  - Cada colección es una tarjeta cuadrada grande con su foto de portada. Sobre la foto van el nombre, los productos y el total.
  - Adentro de la colección se carga o cambia la foto (cuadrada, al costado de los datos).
- **Publicidad a uno o varios productos**
  - Al cargar publicidad la pregunta es "¿Qué producto/s o colección?" y se pueden tildar varios productos.
  - Con uno solo funciona como antes. Con varios, el gasto se reparte entre ellos según las unidades de cada uno (en cada producto se usa su tanda abierta más reciente).
  - Sigue estando la opción de cargarla a la colección entera.
- **Ficha del producto**
  - La foto es cuadrada y ocupa la mitad del ancho, con la colección y el botón "Cambiar foto" al costado.
  - Se sacó el cuadro de costos por unidad (producción / con desarrollo / costo de referencia). La simulación de gastos generales sigue en Gestionar, pero ya no se suma en el producto. El botón ahora dice "Guardar simulación".
  - "De dónde sale" pasó a llamarse **Balance**. Orden: Producción, Muestras y moldería, Packaging → **Total de fabricación y desarrollo**; después Campaña asignada, Publicidad asignada → **Total directo asignado**. Cada fila muestra el total y el valor por unidad.
  - **Packaging de cada prenda:** botón "Vincular packaging". Elegís el insumo (bolsa transparente, stickers…); si hay varias compras, te pregunta cuál. El precio por unidad sale de esa compra (lo que pagaste ÷ unidades compradas). Viene puesto 1 por prenda y se puede cambiar (por ejemplo, 2 stickers). Si la compra no tenía la cantidad cargada, la pide ahí mismo.
  - **Rendimiento de tela:** arriba queda el cuadro con el total de toda la tela. Abajo, "Telas utilizadas": una fila por tela (según el nombre de la descripción del gasto), de la que más se usó a la que menos. Al tocarla se despliega el mismo cuadro para esa tela, con el porcentaje del total de tela.
  - **Conceptos de producción:** arriba van las unidades, y cada concepto muestra el total y el valor por unidad.

**Por qué**
- Pedido del usuario con 12 capturas del celular. Decisiones que confirmó: la colección se ve **cuadrada** y con foto; el packaging va **dentro de fabricación y desarrollo**; se carga **1 por prenda, y se puede cambiar**.

**Notas técnicas**
- Esquema v3 (`src/schema.js`): `colecciones.foto_id`, tabla `gasto_tandas` (publicidad repartida entre varias tandas) y tabla `producto_packaging` (producto, compra de packaging, `por_prenda`).
- Worker: ruta `PUT /api/gastos/:id/tandas`, tabla `producto_packaging` en la API genérica, y limpieza de los vínculos al borrar gastos, tandas o productos.
- `calc.js`: `publiMultiInfo`, `packagingInfo`, `tandaCosts` devuelve `fabricacion` y `lineas.packaging`; los gastos con varias tandas llevan la marca `_multi` al indexar.
- Pruebas nuevas en `test/calc.test.js` (reparto entre varios productos y packaging). Caché de la app `dg-v3`.
- Probado en la app local con un tamaño de celular: Resumen, Colecciones, ficha del producto, vincular packaging y carga de publicidad a dos productos.
- Se agregó `.claude/launch.json` para levantar la app local desde Claude.

## 2026-10-26 — Muestras, rendimiento de tela y publicidad por colección

**Qué cambió**
- Las muestras tienen sus propios conceptos: tela, molde, corte, confección, cadete.
- Al cargar un gasto de tela se pueden anotar los **kg**. En la ficha del producto aparece el **rendimiento**: unidades por kg, consumo por prenda y costo por kg, en total y por cada tela.
- En las listas de gastos, la descripción va arriba y el concepto y el producto abajo.
- La **publicidad** se puede cargar a una colección entera; se reparte entre sus productos según las unidades de cada uno.
- El botón **+** quedó centrado en la barra, y el campo de fecha ya no se sale de la pantalla en iPhone.

**Notas técnicas**
- Esquema v2: columnas `kg` y `coleccion_id` en `gastos` (`src/schema.js`).
- Cálculos nuevos en `public/js/calc.js`, con pruebas en `test/calc.test.js`.
- Commit `24271b8`.

## 2026-10-25 — Ajustes de configuración y guía

- La guía (README) corrige los límites del plan gratis de Cloudflare. Commit `66a15c2`.
- `wrangler.jsonc` conserva las variables de Notion del Worker, para que el botón de importar siga funcionando después de publicar. Commit `5c4447a`.

## 2026-10-25 — App nueva: carga de gastos y costos por producto

**Qué cambió**
- Se reemplazó el dashboard que leía Notion (y el atajo de iPhone para cargar) por una **app que se instala en el teléfono**.
- Guarda todo en Cloudflare (Worker `gastos-desgoises` + base D1 `desgoises-gastos`): muestras, productos con tandas, colecciones, campañas con reparto por unidades, señas y saldos, gastos generales y simulación de cobertura.
- Botón para **importar los gastos viejos de Notion**.
- El link viejo de GitHub Pages redirige a la app nueva.

**Por qué**
- Notion solo guardaba importe, categoría y medio de pago; no permitía calcular cuánto cuesta cada producto.

**Decisiones**
- El desarrollo (muestras vinculadas y moldería) se cuenta una sola vez, en la primera tanda del producto.
- La clave de la app es el secreto `APP_KEY`; si no existe, usa el `DASH_KEY` del dashboard anterior.
- Las fotos se guardan en la misma base (sin R2), achicadas en el teléfono.

**Notas técnicas**
- Commit `a635783`.

## 2026-10-19 — Primera versión

- Dashboard en GitHub Pages (`index.html`) que leía los gastos de Notion a través de Cloudflare.
