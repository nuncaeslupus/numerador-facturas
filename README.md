# numerador-facturas

**Numera facturas PDF en lote desde el navegador.** Estampa un número correlativo
(`F-0001`, `F-0002`…) en **todas las páginas** de cada factura y te devuelve un ZIP listo
para entregar. Todo ocurre del lado del cliente: **los PDFs nunca salen de tu equipo.**

Resuelve el trámite de foliar o numerar un lote de facturas sin subir documentos sensibles
a ningún servicio y sin software de escritorio.

**Web:** https://nuncaeslupus.github.io/numerador-facturas/

## Inicio rápido

```bash
make sync     # npm install
make dev      # servidor local
```

Abre el navegador, arrastra tus PDFs, define la plantilla de numeración y descarga el ZIP.

## Ejemplo

Plantilla `F-{n:4}` sobre tres archivos empezando en el número 1:

```
plantilla "F-{n:4}", número 7  -> F-0007
rango de 3 archivos, inicio 1  -> del 1 al 3

factura-1.pdf  ->  F-0001_factura-1.pdf
factura-2.pdf  ->  F-0002_factura-2.pdf
factura-3.pdf  ->  F-0003_factura-3.pdf
```

El número se estampa en cada página; la salida es un ZIP con un PDF por factura y/o un
único PDF con todas unidas.

## Uso

1. **Archivos** — elige o arrastra los PDFs. Se ordenan por nombre (orden natural: `2`
   antes que `10`) o por fecha de modificación; luego puedes reordenarlos arrastrando o
   con ↑ ↓.
2. **Numeración** — plantilla con un marcador: `{n:4}` rellena con ceros (`0007`), `{n}`
   sin ceros. Indica el número inicial **o** el final; el otro se calcula según el número
   de archivos. Si das ambos y no cuadran, avisa.
3. **Posición y aspecto** — haz clic en la vista previa o escribe la distancia en mm desde
   la izquierda/derecha y desde arriba/abajo (por defecto, 10 mm de la esquina superior
   derecha). Así funciona igual en A4 y en recibos más bajos. Fuente, tamaño y color del
   número, y un recuadro opcional detrás con su color y margen.
4. **Resultado** — un ZIP con un PDF por factura (`F-0001_original.pdf`) y/o un único PDF
   con todas juntas.

Los PDFs protegidos se abren: si piden contraseña, la página la pregunta (no se guarda). La
copia numerada sale **sin protección**. Los archivos que no se pueden leer se avisan arriba
de la lista y no se numeran.

Disponible en español, inglés, francés, italiano, alemán y chino (según el idioma del
navegador, o el que elijas arriba). La configuración se recuerda en el navegador
(`localStorage`).

## Privacidad

Sitio estático sin backend. La página lleva una Content-Security-Policy que solo permite
cargar recursos del propio sitio, y un test comprueba que el código no hace peticiones de
red (`fetch`, XHR, WebSocket…).

## Usar desde una IA (MCP)

La web no tiene API: lo que usa un LLM es [`mcp/`](mcp/README.md), un servidor MCP sin UI que
reutiliza el código de `src/` y se ejecuta en tu equipo, sin red. La propia web explica cómo
instalarlo y sirve el `.mcpb` para Claude Desktop y un
[`llms.txt`](https://nuncaeslupus.github.io/numerador-facturas/llms.txt) para los LLM.

## Desarrollo

Vite + TypeScript, [@cantoo/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) (pdf-lib con
soporte de cifrado) para estampar y unir, [pdf.js](https://mozilla.github.io/pdf.js/) para
la vista previa y [fflate](https://github.com/101arrowz/fflate) para el ZIP.

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

## Proyectos relacionados

- [claude-arsenal](https://github.com/nuncaeslupus/claude-arsenal) — flujo spec-driven para Claude Code y cola de tareas con gates.
- [drawspec](https://github.com/nuncaeslupus/drawspec) — spec declarativo de diagramas → SVG/PNG/texto limpio, escribible por LLMs; incluye servidor MCP.
- [doc-control](https://github.com/nuncaeslupus/doc-control) — permite a agentes de IA editar documentos Word como cambios con control de versiones.
- [literary-critic](https://github.com/nuncaeslupus/literary-critic) — análisis de manuscritos con LLM como lo haría un editor profesional.
- [integral-job-search](https://github.com/nuncaeslupus/integral-job-search) — búsqueda de empleo centrada en el candidato, dentro de Claude Code.

## Licencia

MIT — ver [LICENSE](LICENSE).
