# Des Goises · Gastos — instrucciones para Claude

App de gastos y costos por producto de la marca de ropa Des Goises. Cloudflare Worker + D1, PWA en `public/`. La guía para el usuario está en `README.md`.

## Registro de cambios (obligatorio)

- **Antes de empezar**, leer `CAMBIOS.md`: ahí está todo lo que se hizo, incluso desde otras computadoras, y las dudas pendientes.
- **Después de cada cambio**, agregar una entrada arriba de todo en `CAMBIOS.md` (fecha, qué cambió para quien usa la app, por qué, notas técnicas) y actualizar la sección "Estado actual". Incluirlo en el mismo commit que el cambio.
- Si el usuario cuenta cambios hechos en otro lado, anotarlos igual en `CAMBIOS.md`.
- Escribir en castellano rioplatense y en palabras simples: el usuario no es programador.

## Reglas del proyecto

- **Regla de comodidad:** todo lo que se agregue tiene que ser cómodo y útil para quien carga desde el celular. Si complica, no se hace. Preferir menos pasos, campos opcionales y crear opciones dentro del mismo flujo de carga.
- Publicar es un solo `npx wrangler deploy`; no agregar configuraciones extra para hostear.
- Si se cambia la base, subir la versión del esquema en `src/schema.js` y anotarla en `CAMBIOS.md`.
- Correr `npm test` después de tocar `public/js/calc.js`.
- **Diseño:** antes de cambiar cualquier pantalla, usar siempre el skill **ui-ux-pro-max** (`anthropic-skills:ui-ux-pro-max`) y respetar el estilo que ya tiene la app (oscuro, monocromo, tarjetas redondeadas, filas tocables de al menos 44 px).
- Si se cambian archivos de `public/`, subir la versión de `CACHE` en `public/sw.js` para que los teléfonos bajen la versión nueva.
- Para probar en la computadora: `npm run dev` (clave local en `.dev.vars`: `APP_KEY=prueba`, ese archivo no se sube).
