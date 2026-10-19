# Specification: Numerador de facturas

**Date**: 2026-10-19
**Ticket / PR**: —
**Author**: ivant + Claude
**Revision**: 3
**Status**: approved (2026-10-19, revision 3) — without annotations
**Revision log**:
- r1 — first draft
- r2 — facturas de proveedores con formatos y tamaños distintos (recibos bancarios no A4): posición anclada a esquina, vista previa por archivo; `data/` privado
- r3 — sitio libre medido desde el borde elegido (arriba/abajo × izq/der); recuadro blanco opcional

---

## 1. Problem statement

Tengo facturas de proveedores en PDF (de 1 o varias páginas), **cada una con su propio
formato**, más recibos bancarios que **no son A4** (mismo ancho, ~21 cm, pero altura
distinta). Necesito estamparles un número correlativo con formato configurable
(p.ej. `F-0001`) en un sitio que no moleste —por defecto **arriba a la derecha**— en
**todas** las páginas de cada factura (todas las páginas de una misma
factura llevan el mismo número). Debe funcionar en lote, ser una web estática en GitHub
Pages (como farma-kit e image-to-svg) y **todo ocurre en el navegador**: ningún PDF ni
dato sale del equipo.

**Flujo**: Elegir archivo(s) → ordenar → parámetros (formato, inicio/fin, posición,
fuente, tamaño) → vista previa → descargar (ZIP con un PDF por factura y/o un único PDF
combinado).

**Success criteria (measurable)**:

- [ ] `network_requests_with_pdf_data == 0` — la app no hace ninguna petición de red tras cargar (verificado: sin `fetch`/XHR en el código y CSP `connect-src 'none'` salvo self).
- [ ] `unit_tests_failed == 0` — formato de número, cálculo de rango, orden natural y estampado (pdf-lib) cubiertos por Vitest.
- [ ] `stamp_text_found_on_every_page == true` — test: un PDF de 3 páginas estampado contiene el mismo número en las 3 páginas (extraído con pdfjs).
- [ ] `batch_60_files_seconds <= 10` — 60 facturas de 1–2 páginas se procesan en ≤ 10 s en un portátil normal (medido a mano con las facturas de ejemplo).
- [ ] La web se publica en `https://nuncaeslupus.github.io/numerador-facturas/` vía GitHub Actions al hacer push a `main`.

## 2. Systems & Impact

| System | Type | Role | Needs changes? | Impact | Severity |
|--------|------|------|----------------|--------|----------|
| Web app (nuevo repo) | Primary | UI + procesado PDF en cliente | Yes | Todo nuevo | Low |
| GitHub Pages + Actions | Infrastructure | Hosting estático, CI | Yes | Workflow `deploy.yml` + `ci.yml` copiados de image-to-svg | Low |
| PDFs del usuario | Data | Entrada, nunca se suben | No | Se leen con `File.arrayBuffer()`; la salida se descarga con `Blob` | Low |

## 3. Options

### Option A: Vite + TypeScript vanilla + pdf-lib + pdfjs-dist (Recommended)

- **Description**: Mismo stack de PDF que farma-kit (pdf-lib para escribir, pdfjs-dist para la vista previa y el clic de posición). UI en TS sin framework (una sola pantalla con un formulario). `fflate` para el ZIP.
- **Scope**: una página, ~5 módulos (`format`, `order`, `stamp`, `preview`, `main`).
- **Effort**: Medium
- **Tradeoffs**: Para el futuro diseñador (tipo farma-kit) quizá convenga Lit; se puede introducir entonces sin rehacer la lógica (los módulos de lógica son puros).
- **Compatibility**: Navegadores modernos (Chrome/Firefox/Edge/Safari recientes).

### Option B: Lit (como farma-kit) desde el principio

- **Description**: Igual que A pero con componentes Lit.
- **Effort**: Medium-Large
- **Tradeoffs**: Más estructura de la necesaria para un único formulario hoy.

### Option C: Script local (Python/CLI)

- **Description**: Herramienta de línea de comandos.
- **Tradeoffs**: No cumple "web en GitHub". Descartada.

### Comparison

| | Option A | Option B | Option C |
|---|---|---|---|
| Effort | Medio | Medio-alto | Bajo |
| Risk | Bajo | Bajo | — |
| Completeness | Completo | Completo | No cumple |
| Maintenance | Baja | Media | Baja |

## 4. Recommendation

**Recommended option**: Option A.

### Comportamiento detallado

**Entrada**
- `<input type="file" multiple accept="application/pdf">` + arrastrar y soltar.
- Orden por defecto: **natural por nombre** (`factura2` < `factura10`, `Intl.Collator` con `numeric: true`). Selector alternativo: *fecha de modificación*. La lista se puede **reordenar a mano** (arrastrar, y botones ↑/↓ por accesibilidad) y quitar archivos.
- Cada fila muestra: nº asignado, nombre, nº de páginas.
- PDFs cifrados o corruptos: la fila se marca con error y se excluye; no bloquea al resto.

**Numeración**
- **Plantilla** con marcador `{n}` o `{n:D}` (D = dígitos con ceros a la izquierda). Ej.: `F-{n:4}` → `F-0001`; `2026/{n:3}` → `2026/001`. Debe contener exactamente un marcador. Vista previa en vivo del primer y último número.
- **Rango**: campos *Número inicial* y *Número final* (opcionales).
  - Solo inicial → correlativo desde ahí.
  - Solo final → se calcula `inicial = final − nArchivos + 1` (error si < 0).
  - Ambos → deben cuadrar con el nº de archivos; si no, aviso y no se genera.
  - Ninguno → empieza en 1.

**Estampado**
- **Sitio libre**, medido desde los bordes que elijas: referencia horizontal (*desde la izquierda* / *desde la derecha*) + distancia en mm, y referencia vertical (*desde arriba* / *desde abajo*) + distancia en mm. Por defecto: 10 mm desde la derecha, 10 mm desde arriba. Así, en páginas de distinto tamaño (A4, recibos bancarios de 21 cm de ancho y menos alto) el número queda a la misma distancia del borde elegido.
- El texto crece hacia dentro de la página desde ese punto (referencia derecha → alineado a la derecha; referencia abajo → la línea base queda por encima del punto).
- Igual para todas las páginas de todas las facturas.
- **Clic en la vista previa** en cualquier sitio: fija el punto y calcula las dos distancias con las referencias actualmente elegidas. Cambiar una referencia recalcula su distancia para que el punto no se mueva en la página mostrada.
- **Recuadro blanco opcional** detrás del número (con 1 mm de margen), para que se lea aunque caiga sobre contenido.
- **Vista previa navegable**: ◀ ▶ para recorrer cada archivo (1ª página) con el número superpuesto, para comprobar que no tapa nada en ningún proveedor. Las páginas que no son A4 se indican en la lista con su tamaño.
- Fuente: las 12 estándar de PDF (Helvetica, Times, Courier × normal/negrita/cursiva) — no hace falta incrustar fuentes. Tamaño en pt. Color.
- Páginas con rotación (`/Rotate`) o CropBox ≠ MediaBox: la esquina y los márgenes se aplican sobre la página tal como se ve.

**Salida**
- **ZIP** con un PDF por factura. Nombre del archivo: el nº formateado + nombre original (`F-0001_original.pdf`; caracteres `/` del número se sustituyen por `-`).
- Opción **"Combinar en un único PDF"** (en orden).
- Ambas casillas pueden marcarse a la vez.

**Persistencia**: los parámetros (plantilla, posición, fuente, tamaño, último nº usado) se recuerdan en `localStorage`. Los PDFs no.

**Privacidad**: sin backend, sin analítica, sin peticiones de red; CSP restrictiva en `index.html`. Funciona offline una vez cargada.

**Idioma**: castellano.

### Fuera de alcance (v1)
- Diseñador visual multi-campo tipo farma-kit (fase 2).
- Posición distinta por página/factura, fuentes TTF personalizadas, PWA instalable.
- Leer la fecha de factura del contenido del PDF para ordenar.

**Immediate next action**: aprobar spec → plan de tareas → implementar.

**Open questions**:
- [ ] ¿El número va solo en la 1ª página o en todas? → **Asumido: todas** (lo dijiste explícitamente).
- [ ] Muestras: el usuario indicará qué archivo de `data/` se puede abrir, si alguno. Los tests usan PDFs sintéticos (A4 y recibo 210×99 mm).

**Decisions log**:

| ID | Decision | Status | Date |
|----|----------|--------|------|
| D-1 | "de la 4 a la 60" = nº inicial / final, no subconjunto de archivos | agreed | 2026-10-19 |
| D-2 | Orden natural por nombre + opción fecha + reordenar a mano | agreed | 2026-10-19 |
| D-3 | Formato por plantilla `{n:D}` | agreed | 2026-10-19 |
| D-4 | Posición por clic en vista previa + campos mm | superseded by D-6 | 2026-10-19 |
| D-6 | Posición = esquina (def. arriba-der) + márgenes mm; vista previa recorre todos los archivos | superseded by D-8 | 2026-10-19 |
| D-7 | Las facturas reales viven en `data/` (git-ignored); los tests usan PDFs sintéticos | agreed | 2026-10-19 |
| D-8 | Sitio libre: distancia desde izq/der + desde arriba/abajo (def. 10 mm der, 10 mm arriba); clic en cualquier punto; recuadro blanco opcional; vista previa recorre todos los archivos | agreed | 2026-10-19 |
| D-5 | Stack: Vite + TS vanilla + pdf-lib + pdfjs-dist + fflate | agreed | 2026-10-19 |

---

## 5. Contracts

No hay API ni base de datos. Los contratos son las funciones puras entre módulos:

```ts
// src/format.ts
parseTemplate(tpl: string): { prefix: string; digits: number; suffix: string }  // throws si no hay exactamente un {n}/{n:D}
formatNumber(tpl: string, n: number): string                                     // ("F-{n:4}", 7) → "F-0007"
resolveRange(count: number, start?: number, end?: number): { start: number; end: number } // throws si no cuadra

// src/order.ts
sortFiles(files: File[], by: 'name' | 'date'): File[]   // natural, estable

// src/stamp.ts
interface StampOptions { fromX: 'left' | 'right'; xMm: number; fromY: 'top' | 'bottom'; yMm: number;
                         background: boolean;  // recuadro blanco
                         font: StandardFontName; sizePt: number; color: string /* #rrggbb */ }
stampPdf(bytes: Uint8Array, text: string, opts: StampOptions): Promise<Uint8Array>  // todas las páginas
mergePdfs(docs: Uint8Array[]): Promise<Uint8Array>

// src/output.ts
outputName(number: string, original: string): string    // "F/0001", "a.pdf" → "F-0001_a.pdf"
zipFiles(files: { name: string; data: Uint8Array }[]): Uint8Array
```

**localStorage** clave `numerador-facturas:v1` → JSON `{ template, start, fromX, xMm, fromY, yMm, background, font, sizePt, color, merge, zip }`.

## 6. Risks & Validation

| Risk | Likelihood | Impact | Mitigation | Validation |
|------|-----------|--------|------------|------------|
| Un proveedor tiene contenido justo en la esquina elegida y el número lo tapa | Med | Med | Vista previa archivo a archivo antes de descargar; márgenes ajustables | manual |
| Página con `/Rotate` 90/270 o CropBox ≠ MediaBox → número en sitio equivocado | Med | Med | Convertir coordenadas usando rotación y CropBox de cada página | unit (PDF generado con rotación) |
| PDF cifrado/corrupto rompe el lote | Med | Low | try/catch por archivo, fila marcada en error | unit |
| Memoria con lotes grandes (cientos de PDFs) al combinar | Low | Med | Procesar secuencialmente; liberar buffers; aviso si > 500 MB | manual |
| Fuentes estándar no tienen todos los glifos (p.ej. `€`, `º`) | Low | Low | WinAnsi cubre `º`/`€`; validar plantilla y avisar si un carácter no es codificable | unit |
| `lastModified` no fiable para ordenar por fecha | Med | Low | Por defecto nombre; reordenar a mano | manual |
