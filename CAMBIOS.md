# Registro de cambios

Todo lo que cambia en la app queda anotado acá, del más nuevo al más viejo.
Sirve para retomar el trabajo desde cualquier computadora (y para que Claude sepa qué se hizo antes).

Cada entrada dice **qué cambió para quien usa la app**, **por qué**, y al final las **notas técnicas** (archivos, base de datos) cuando hacen falta.

---

## Estado actual

- **Publicación:** automática. Desde el 26/10, Cloudflare (Settings → Build) está conectado al repositorio de GitHub, rama `main`: cada vez que se sube algo, la app se publica sola en uno o dos minutos. Ya no hace falta `npx wrangler deploy`.
- **Versión de la base de datos:** v5 (envíos y cadetes, envíos vinculados a telas o moldes, conceptos de moldería, prendas entregadas en campañas). Se actualiza sola en la primera visita después de publicar.
- **Pendientes / dudas abiertas:**
  - **Prendas entregadas en la colección:** se muestran en el balance pero **no** se suman al costo total, porque fabricarlas ya está contado en Producción (si no, se contaría dos veces). Confirmar con el usuario que está bien así.
  - El packaging vinculado se suma en el producto, pero **no** en el total de la colección (el usuario no lo puso en la lista del balance de la colección).
  - Si una publicidad se reparte entre productos de **colecciones distintas**, en cada colección se cuenta el gasto entero (no solo su parte).
  - Esta computadora no tiene Node: los cambios del 27/10 se probaron con un servidor de prueba en Python y datos de ejemplo, no con `npm run dev`. Las pruebas de `test/calc.test.js` se corrieron en el navegador.

---

## 2026-10-27 (2) — Encuadre de fotos, estado automático, moldería compartida, envíos y cadetes, otros gastos, prendas entregadas

**Qué cambió**
- **Fotos:** al elegir una foto (producto, muestra o colección) se abre "Encuadrar foto": se arrastra para centrarla y se acerca con dos dedos o con la barra. Se guarda cuadrada, tal cual se ve. El botón para cambiarla ahora es una camarita sobre la foto.
- **Ficha del producto**
  - Arriba a la derecha: Colección, **Producción** (total y por unidad), **Directo** (total y por unidad) y el estado de la producción con un punto de color: gris **En preparación**, naranja **En producción**, verde **Producción finalizada**.
  - El estado **ya no se elige**: está en preparación hasta la primera compra de **tela de producción** (las muestras no cuentan), pasa a producción con esa compra, y queda finalizada al tocar "Revisada y cerrada". El cuadro de la tanda arranca directo con las cantidades.
  - En el Balance, "Muestras y moldería" se separó en **Muestras** y **Moldería todos los talles**. Al desplegar la moldería se ve cada molde con su total y cuánto le toca a cada unidad; si el molde sirve para varios productos, se divide entre las unidades de todos.
- **Productos:** sin los filtros de arriba. Todos los productos uno abajo del otro, con el nombre de la colección chiquito arriba de cada grupo.
- **Resumen**
  - El **Saldo pendiente** se puede tocar (se ve igual que antes): abre la lista de **Saldos pendientes**, y tocando cada uno se registra el pago con el saldo ya puesto.
  - Balance: Producción muestra cada producto; **Muestras** y **Moldería todos los talles** arrancan cerradas, con la flechita hacia abajo a la derecha; al abrirlas aparece cada muestra o molde, que a su vez se despliega.
  - En Gastos no asignados aparece **Otros gastos** (postventa, comisiones y administración), también desplegable.
- **Carga de gastos**
  - "Moldería" ahora se llama **Moldería todos los talles**, pregunta **"¿Qué producto/s?"** y se pueden elegir varios: el gasto se reparte por las unidades (de la primera producción de cada uno). Tiene conceptos: Moldería papel kraft y Moldería papel.
  - Desapareció "Envíos y posventa". Ahora están **Envíos y cadetes** (antepenúltima) y **Otros gastos** (última, con Postventa, Comisiones y cobros, Administración e impuestos).
  - **Envíos y cadetes:** se elige Correo, Expreso o Cadete → "¿… relacionado a qué?" con todos los conceptos (de muestras, producción, moldería y campañas) → a qué muestra, producto o campaña. Con **tela** o **moldería** (incluido el molde de muestras) se eligen una o varias compras, de la más nueva a la más vieja, y el envío se reparte **según lo que costó cada compra** (no por kilos).
  - El envío **no es una categoría nueva**: se suma dentro del concepto que corresponde. Por ejemplo, el cadete de la frisa aparece en la Producción del producto como un gasto más, con su descripción y la parte que le toca.
- **Colección**
  - Al lado de la foto: "X productos" y una vista previa de hasta 12 productos (3 filas de 4), que se llena desde la fila de abajo; el texto queda justo arriba de la última fila con productos.
  - Los totales (costo total, pagado, pendiente) quedaron en una franja chica.
  - **Balance de la producción**: Producción, Muestras y Moldería todos los talles (con su cantidad entre paréntesis) → **Total de fabricación y desarrollo de la colección** → Campañas de contenido y Publicidad de sus productos → **Costo total de la colección**. Todo arranca cerrado; adentro, cada producto, muestra, molde o campaña se despliega con su detalle.
  - "Publicidad de la colección" pasó al final de la pantalla.
- **Campaña:** primero los gastos (con el botón para cargar) y después el reparto por unidades.
- **Gestionar:** salieron Colecciones y Campañas (ya están en su pestaña). Se agregó **Moldería todos los talles**, con cada molde por el nombre de la descripción, y **Conceptos de moldería** en opciones de carga.
- **Prendas entregadas como parte de pago** (campañas de contenido)
  - En la campaña: primero los gastos, después "Prendas entregadas como parte de pago" y abajo el reparto por unidades. El botón **"Prenda entregada como parte de pago"** va antes de "Cargar gasto a esta campaña": se elige cuántas unidades de cada producto (con − y +).
  - Cada prenda suma a la campaña su **costo de fabricación y desarrollo por unidad** (de la tanda más reciente que tenga cantidad). Arriba se ve "Gastos $ X + prendas entregadas $ Y".
  - Ese total se reparte por unidades como el resto de la campaña. En la ficha del producto aparece **"Prendas entregadas como parte de pago"** debajo de "Campaña asignada", con la parte que le toca, y suma al total directo.
  - En la colección aparece la línea "Prendas entregadas como parte de pago (N prendas)" con el aviso "ya está en producción": se ve, pero no se vuelve a sumar al costo total de la colección.
- **Detalle de un gasto:** un envío muestra entre qué compras se repartió; una moldería compartida muestra qué productos la usan y cuánto le toca a cada uno; una compra de tela o moldería muestra sus envíos.

**Por qué**
- Pedido del usuario con 15 capturas del celular.

**Decisiones**
- La moldería compartida se reparte con las unidades de la **primera producción** de cada producto, porque el desarrollo se cuenta una sola vez, ahí.
- Lo que estaba cargado como "Envíos y posventa" pasa a **Postventa**.
- En las listas, la parte de un envío repartido muestra lo que le toca y, abajo, "de $ total del envío".

**Notas técnicas**
- Esquema v5 (`src/schema.js`): `gastos.envio` (`correo` | `expreso` | `cadete`), tabla `campana_prendas` (campaña, producto, tanda, cantidad), tabla `gasto_vinculos` (envío → compras de tela o moldería), `UPDATE` de `envios` a `posventa`, opciones `concepto_molde`.
- Worker: columna `envio` validada, rutas `PUT /api/gastos/:id/vinculos` y `PUT /api/campanas/:id/prendas`, `gastoVinculos` y `campanaPrendas` en `/api/data` y limpieza de vínculos al borrar un gasto. Importación de Notion: "Envíos" → `posventa`.
- `calc.js`: `MENU_CARGA`, `ENVIO`, `estadoProduccion`, `costoFabricacion`, `prendasCampana`, `tandaParaPrenda` (`campaignInfo` suma las prendas y devuelve `totalGastos`, `totalPrendas` y `asignadoPrendas`; `tandaCosts` tiene `lineas.prendas`), `multiInfo` (reemplaza a `publiMultiInfo`, que queda como atajo), `moldesDeProducto`, `gastosMuestras`, `expandir`. `index()` arma `I.gastos`, donde cada envío vinculado se reemplaza por sus partes (repartidas con `splitByUnits` según el monto de cada compra); los índices por tanda, producto y muestra usan esa lista. `tandaCosts` y `coleccionCosts` devuelven `lineas.muestras` y `lineas.molderia` (se mantiene `lineas.desarrollo`). `tandas.estado` ya no se usa.
- `ui.js`: `cropSquare(file)` (encuadre con arrastre, pellizco y barra).
- 4 pruebas nuevas (23 en total, todas pasan, corridas en el navegador). Caché de la app `dg-v5`.

## 2026-10-27 — Balance y conclusión en el Resumen, muestras con foto, tipos de estampa

**Qué cambió**
- **Resumen**
  - "Por categoría" pasó a ser un **Balance**: Producción y Muestras → **Gastos de producir ropa**; después Campañas de contenido de colecciones y Publicidad → **Gastos de producir y vender ropa**.
  - Dentro de cada línea ya no aparecen los gastos sueltos: aparece **cada muestra, producto o campaña** con una flechita. Al desplegarla se ven las descripciones de sus gastos.
  - Debajo, **Gastos no asignados**: equipamiento, packaging y presentación, suscripciones y fijos (y envíos, comisiones o administración si hubo), y **Muestras no producidas**.
  - Al final, **Conclusión del mes** (o del año): un cuadro con las colecciones que tuvieron producción (Comenzó / En curso / Terminada / Completa) y en qué paso está cada producto, y abajo un texto que explica en qué se fue la plata: producción, muestras, campañas (qué parte del mes y de la colección son), gastos fuera de producción, compras únicas grandes (por ejemplo, un foco) y saldos pagados de meses anteriores.
  - La conclusión **se arma sola** con lo que se carga; no hay que tocar nada ni actualizarla.
- **Muestras**
  - Cada muestra tiene **foto** (cuadrada, arriba, al lado del total acumulado). La lista de Gestionar → Muestras muestra esa foto.
  - Debajo aparece **Tela/s utilizada/s** (solo los nombres).
  - Casilla **"No se va a producir"**: al tildarla, lo gastado en esa muestra pasa a "Gastos no asignados" del Resumen como gasto extra (si estaba vinculada a un producto, se desvincula).
- **Carga de estampa:** al elegir el concepto Estampa pregunta el tipo: **Bordado, Serigrafía o DTF**. Con Serigrafía aparece la casilla **"Estampado por mí"**; tildada, el campo de descripción pasa a "¿Qué compraste para estampar?", para cargar cada compra (tinta, shablón…) aparte.
- **Ficha del producto → Conceptos de producción**
  - **Tela** se despliega: cada tela con kilos y plata, en total y por unidad, y qué porcentaje de toda la tela es.
  - **Estampa** se despliega por método (Bordado, DTF, Serigrafía ajena, Serigrafía por mí) y cada uno muestra sus gastos con total y valor por unidad. El total de Estampa es la suma de todos.
- **Colecciones:** las tarjetas siguen cuadradas pero más chicas, de a dos por fila.

**Por qué**
- Pedido del usuario con 7 capturas del celular. La idea de la conclusión es entender rápido, sobre todo mirando meses anteriores, si el mes se fue en producir colecciones, en muestras o en terminar de pagar.

**Decisiones**
- El paso de cada producto sale del último gasto de producción cargado, en este orden: tela → corte → estampa → confección → lavadero. Si hay gasto de un paso, el producto está en el siguiente (salteando los marcados "No aplica"). Una colección está terminada cuando todas sus tandas están "Revisada y cerrada"; la fecha de cierre sale del historial.
- El tipo de estampa no es obligatorio: si no se elige, en la ficha figura como "Sin tipo".

**Notas técnicas**
- Esquema v4 (`src/schema.js`): `muestras.foto_id`, `muestras.no_produce`, `gastos.estampa` (`bordado` | `serigrafia` | `serigrafia_propia` | `dtf`). El Worker acepta esas columnas y valida el tipo de estampa.
- `calc.js`: `balancePeriodo`, `conclusionPeriodo`, `pasoTanda`, `estampaInfo`, `telasDeMuestra`, `muestraNoProducida`, `inPeriod` (se movió desde `app.js`) y `telaInfo().porNombre`.
- 4 pruebas nuevas en `test/calc.test.js` (19 en total, todas pasan). Como acá no hay Node, se corrieron en el navegador con un servidor de prueba en Python y se revisaron las pantallas con tamaño de celular y datos de ejemplo.
- Caché de la app `dg-v4`.

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
