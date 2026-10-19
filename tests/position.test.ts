import { expect, it } from "vitest";
import { offsetsToPoint, pointToOffsets } from "../src/position";

it("test_pointToOffsets_from_right_bottom_returns_distances", () => {
  const page = { width: 210, height: 99 };
  const o = pointToOffsets({ x: 180, y: 90 }, page, "right", "bottom");
  expect(o).toEqual({ fromX: "right", xMm: 30, fromY: "bottom", yMm: 9 });
  expect(offsetsToPoint(o, page)).toEqual({ x: 180, y: 90 });
});

it("same offsets from the top-right land at the same distance on A4 and a receipt", () => {
  const o = { fromX: "right", xMm: 10, fromY: "top", yMm: 10 } as const;
  expect(offsetsToPoint(o, { width: 210, height: 297 })).toEqual({ x: 200, y: 10 });
  expect(offsetsToPoint(o, { width: 210, height: 99 })).toEqual({ x: 200, y: 10 });
});
