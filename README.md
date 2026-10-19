# numerador-facturas

Numera facturas PDF en lote desde el navegador: estampa un número correlativo
(`F-0001`, `F-0002`…) en **todas las páginas** de cada factura. Todo ocurre del
lado del cliente — los PDFs nunca salen de tu equipo.

**Web:** https://nuncaeslupus.github.io/numerador-facturas/

## Uso

1. **Archivos** — elige o arrastra los PDFs. Se ordenan por nombre (orden
   natural: `2` antes que `10`) o por fecha de modificación; luego puedes
   reordenarlos arrastrando o con ↑ ↓.
2. **Numeración** — plantilla con un marcador: `{n:4}` rellena con ceros
   (`0007`), `{n}` sin ceros. Indica el número inicial **o** el final; el otro se
   calcula según el número de archivos. Si das ambos y no cuadran, avisa.
3. **Posición y aspecto** — haz clic en la vista previa o escribe la distancia
   en mm desde la izquierda/derecha y desde arriba/abajo (por defecto, 10 mm de la
   esquina superior derecha). Así funciona igual en A4 y en recibos más bajos.
   Fuente, tamaño y color del número, y un recuadro opcional detrás con su color y
   margen (p. ej. recuadro negro y número blanco).
4. **Resultado** — un ZIP con un PDF por factura (`F-0001_original.pdf`) y/o un
   único PDF con todas juntas.

Los PDFs protegidos se abren: si piden contraseña para abrirlos, la página la
pregunta (no se guarda). La copia numerada sale **sin protección**. Los archivos
que no se pueden leer se avisan arriba de la lista y no se numeran.

Gratis y de código abierto. Disponible en español, inglés, francés, italiano,
alemán y chino (según el idioma del navegador, o el que elijas arriba).

La configuración se recuerda en el navegador (`localStorage`).

## Privacidad

Sitio estático sin backend. La página lleva una Content-Security-Policy que solo
permite cargar recursos del propio sitio, y un test comprueba que el código no
hace peticiones de red (`fetch`, XHR, WebSocket…).

## Desarrollo

Vite + TypeScript, [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) (pdf-lib con soporte de cifrado) para estampar y unir,
[pdf.js](https://mozilla.github.io/pdf.js/) para la vista previa y
[fflate](https://github.com/101arrowz/fflate) para el ZIP.

```bash
make sync     # npm install
make dev      # servidor local
make check    # formato, lint, tipos, build y tests
```

Los tests usan PDFs sintéticos. Cada push a `main` se publica en GitHub Pages
(`.github/workflows/deploy.yml`).

Este repo sigue el flujo spec → diseño → ejecución de
[claude-arsenal](https://github.com/nuncaeslupus/claude-arsenal): ver
`status/specification.md` y `status/plan.md`.
