export const PT_PER_MM = 72 / 25.4;

export type FromX = "left" | "right";
export type FromY = "top" | "bottom";

export interface Offsets {
  fromX: FromX;
  xMm: number;
  fromY: FromY;
  yMm: number;
}

/** A point measured from the visible page's top-left, in mm. */
export interface Point {
  x: number;
  y: number;
}

/** Page size as the reader sees it, in mm. */
export interface Size {
  width: number;
  height: number;
}

export function offsetsToPoint(o: Offsets, page: Size): Point {
  return {
    x: o.fromX === "left" ? o.xMm : page.width - o.xMm,
    y: o.fromY === "top" ? o.yMm : page.height - o.yMm,
  };
}

/** Inverse of offsetsToPoint for the given references. Rounded to 0.1 mm. */
export function pointToOffsets(p: Point, page: Size, fromX: FromX, fromY: FromY): Offsets {
  const r = (v: number) => Math.round(v * 10) / 10;
  return {
    fromX,
    xMm: r(fromX === "left" ? p.x : page.width - p.x),
    fromY,
    yMm: r(fromY === "top" ? p.y : page.height - p.y),
  };
}
