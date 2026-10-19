const MARKER = /\{n(?::(\d{1,2}))?\}/g;

/** Throws unless the template holds exactly one `{n}` / `{n:D}` marker. */
export function parseTemplate(tpl: string): { prefix: string; digits: number; suffix: string } {
  const matches = [...tpl.matchAll(MARKER)];
  if (matches.length !== 1)
    throw new Error("La plantilla debe contener exactamente un {n} o {n:4}");
  const m = matches[0];
  return {
    prefix: tpl.slice(0, m.index),
    digits: m[1] ? Number(m[1]) : 0,
    suffix: tpl.slice(m.index + m[0].length),
  };
}

/** formatNumber("F-{n:4}", 7) → "F-0007" */
export function formatNumber(tpl: string, n: number): string {
  const { prefix, digits, suffix } = parseTemplate(tpl);
  return prefix + String(n).padStart(digits, "0") + suffix;
}

/** Start/end of a run of `count` consecutive numbers given an optional start and/or end. */
export function resolveRange(
  count: number,
  start?: number,
  end?: number,
): { start: number; end: number } {
  if (start === undefined && end !== undefined) start = end - count + 1;
  start ??= 1;
  if (start < 0)
    throw new Error(`Con ${count} archivos, el número final ${end} daría un inicio negativo`);
  const last = start + count - 1;
  if (end !== undefined && end !== last)
    throw new Error(
      `Del ${start} al ${end} son ${end - start + 1} números, pero hay ${count} archivos`,
    );
  return { start, end: last };
}
