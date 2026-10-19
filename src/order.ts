const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

/** Natural name order ("f2" < "f10") or oldest-modified first. Stable; returns a new array. */
export function sortFiles<T extends { name: string; lastModified: number }>(
  files: readonly T[],
  by: "name" | "date",
): T[] {
  return [...files].sort((a, b) =>
    by === "name" ? collator.compare(a.name, b.name) : a.lastModified - b.lastModified,
  );
}
