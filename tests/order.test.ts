import { expect, it } from "vitest";
import { sortFiles } from "../src/order";

const f = (name: string, lastModified = 0) => ({ name, lastModified });

it("test_sortFiles_natural_name_orders_2_before_10", () => {
  const out = sortFiles([f("f10.pdf"), f("F2.pdf"), f("f1.pdf")], "name");
  expect(out.map((x) => x.name)).toEqual(["f1.pdf", "F2.pdf", "f10.pdf"]);
});

it("sorts by modification date, oldest first", () => {
  const out = sortFiles([f("a", 3), f("b", 1), f("c", 2)], "date");
  expect(out.map((x) => x.name)).toEqual(["b", "c", "a"]);
});
