# Numerador Facturas — Plan (annotated edition)

> Generated 2026-10-19. This is the document with a **note slot** after every section that has text of its own. Read it in any Markdown app. To annotate, replace the `_(your notes…)_` placeholder under any section. When done, send the file back — notes are acted on.

---

# Plan

## Preamble & scope

**Date**: 2026-10-19
**Specification**: `status/specification.md`
**Author**: ivant + Claude
**Revision**: 3
**Status**: approved (2026-10-19, revision 3) — without annotations
**Revision log**:
- r1 — first draft
- r2 — posición anclada a esquina; vista previa navegable; fixtures sintéticos
- r3 — sitio libre desde bordes elegidos; recuadro blanco opcional

<!-- -->

> **✎ Notes** · `PLAN · intro`
> _(your notes here — replace this line)_

## Technical solution

### Architecture overview

Web estática (Vite + TypeScript, sin framework) desplegada en GitHub Pages. Lógica en
módulos puros testeables (`format`, `order`, `stamp`, `output`) y una capa de UI fina
(`main.ts` + `preview.ts`) sobre un único `index.html`.

<!-- -->

> **✎ Notes** · `PLAN › Architecture overview`
> _(your notes here — replace this line)_

### Data flow

`<input type=file>` → `File[]` → `sortFiles` → (usuario reordena) → por cada archivo:
`arrayBuffer()` → `stampPdf(bytes, formatNumber(tpl, n), opts)` → resultados en memoria →
`zipFiles` y/o `mergePdfs` → `Blob` → descarga con `<a download>`. Nada sale del navegador.

Vista previa: 1ª página del archivo seleccionado (◀ ▶) → pdfjs → `<canvas>` + número superpuesto; clic → punto → distancias mm desde los bordes de referencia elegidos.

<!-- -->

> **✎ Notes** · `PLAN › Data flow`
> _(your notes here — replace this line)_

### State changes

| Service | Database | Change | Description |
|---------|----------|--------|-------------|
| Navegador | localStorage | CREATE/UPDATE | Parámetros del formulario (`numerador-facturas:v1`) |

<!-- -->

> **✎ Notes** · `PLAN › State changes`
> _(your notes here — replace this line)_

### Technology choices

| Choice | Justification |
|--------|--------------|
| pdf-lib | Escribir texto sobre PDFs existentes y combinar; ya usado en farma-kit |
| pdfjs-dist | Renderizar la vista previa para el clic de posición; ya usado en farma-kit |
| fflate | ZIP en cliente, ~8 kB |
| Vite + Vitest | Igual que image-to-svg / farma-kit |

<!-- -->

> **✎ Notes** · `PLAN › Technology choices`
> _(your notes here — replace this line)_

### Out of scope

- Diseñador multi-campo, fuentes personalizadas, PWA, i18n.

<!-- -->

> **✎ Notes** · `PLAN › Out of scope`
> _(your notes here — replace this line)_

## Implementation tasks

| T# | Description | Service | Size | Depends | Gate | Tests |
|----|-------------|---------|------|---------|------|-------|
| T1 | Scaffold Vite+TS, Makefile, CI + deploy a Pages, CSP | web | S | — | `make_check_exit_code == 0` | `test_build_outputs_index_html_with_csp` in `tests/build.test.ts` — el build produce `dist/index.html` con meta CSP |
| T2 | `format.ts`: plantilla `{n:D}` y rango inicio/fin | web | S | T1 | `unit_tests_failed == 0` | `test_formatNumber_padded_template_returns_F0007` in `tests/format.test.ts` — `F-{n:4}`,7 → `F-0007`; `test_resolveRange_end_only_computes_start` — count 5, end 28 → start 24 |
| T3 | `order.ts`: orden natural por nombre / fecha | web | S | T1 | `unit_tests_failed == 0` | `test_sortFiles_natural_name_orders_2_before_10` in `tests/order.test.ts` — `f2` antes que `f10` |
| T4 | `stamp.ts` + `output.ts`: estampar todas las páginas, combinar, ZIP, nombres | web | M | T1 | `stamp_text_found_on_every_page == true` | `test_stampPdf_three_pages_number_on_all` in `tests/stamp.test.ts` — el texto extraído de las 3 páginas contiene el número; `test_stampPdf_receipt_size_top_right_keeps_margin` — en una página 210×99 mm con referencia derecha/arriba a 10 mm el texto queda a 10 mm del borde superior y derecho; `test_stampPdf_rotated_page_places_text_visually` — página rotada 90 coloca el texto en la posición vista; `test_stampPdf_background_draws_white_rect` — con `background` se dibuja un rectángulo blanco antes del texto |
| T5 | UI: carga de archivos, lista ordenable, formulario, vista previa navegable con clic→distancias, descarga, localStorage | web | M | T2, T3, T4 | `unit_tests_failed == 0` | `test_pointToOffsets_from_right_bottom_returns_distances` in `tests/position.test.ts` — un punto en una página 210×99 mm se convierte a distancias desde der/abajo y de vuelta al mismo punto |
| T6 | README, verificación manual por el usuario con sus facturas y lote de 60 | web | S | T5 | `batch_60_files_seconds <= 10` | manual — cronometrar el lote en el navegador |

**Status legend**: ☐ not started · ◐ in progress · ☑ merged

**Merge order**: T1, luego T2/T3/T4 (paralelo), T5, T6
**Branch pattern**: `T<N>-description` desde `main`

<!-- -->

> **✎ Notes** · `PLAN › Implementation tasks`
> _(your notes here — replace this line)_

### Dependency graph

```drawspec
{"version": 1, "kind": "flow", "title": "Task dependencies",
 "nodes": [
  {"id": "T1", "text": "T1"},
  {"id": "T2", "text": "T2"},
  {"id": "T3", "text": "T3"},
  {"id": "T4", "text": "T4"},
  {"id": "T5", "text": "T5"},
  {"id": "T6", "text": "T6"}
 ],
 "edges": [
  {"from": "T1", "to": "T2"},
  {"from": "T1", "to": "T3"},
  {"from": "T1", "to": "T4"},
  {"from": "T2", "to": "T5"},
  {"from": "T3", "to": "T5"},
  {"from": "T4", "to": "T5"},
  {"from": "T5", "to": "T6"}
 ]}
```

<!-- -->

> **✎ Notes** · `PLAN › Dependency graph`
> _(your notes here — replace this line)_

## Evidence log

| T# | Gate | Measured | Command | SHA | Env | Date |
|----|------|----------|---------|-----|-----|------|
| T1 | `make_check_exit_code == 0` | 0 | `make check` | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |
| T2 | `unit_tests_failed == 0` | 0 (23/23) | `npm test` | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |
| T3 | `unit_tests_failed == 0` | 0 (23/23) | `npm test` | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |
| T4 | `stamp_text_found_on_every_page == true` | true | `npx vitest run tests/stamp.test.ts` | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |
| T5 | `unit_tests_failed == 0` | 0 (23/23); UI verificada en navegador con 4 PDFs sintéticos (orden, clic, recuadro, ZIP+PDF, sin peticiones externas) | `npm test` + `vite preview` | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |
| T6 | `batch_60_files_seconds <= 10` | pendiente — medición manual del usuario | manual | a6b0f13 | linux, node v24.13.0 | 2026-10-19 |

<!-- -->

> **✎ Notes** · `PLAN › Evidence log`
> _(your notes here — replace this line)_

## Sign-off

- [ ] Design reviewed
- [ ] Ready for execution

<!-- -->

> **✎ Notes** · `PLAN › Sign-off`
> _(your notes here — replace this line)_

