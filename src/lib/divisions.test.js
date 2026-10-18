import { expect, test } from "bun:test";
import {
  errorMessageKey,
  joinableRegions,
  positionsOf,
  visitingGate,
} from "./divisions";

const row = (region, extra = {}) => ({
  region,
  home: false,
  status: true,
  del: false,
  gnd: false,
  twr: false,
  app: false,
  ctr: false,
  instructor: false,
  director: false,
  ...extra,
});
const state = (extra = {}) => ({
  rating: 4,
  home: row(1, { home: true }),
  visiting: [],
  canSetHome: false,
  canAddVisiting: true,
  minVisitingRating: 1,
  ...extra,
});

test("no home division: the gate asks for one first", () => {
  expect(visitingGate(state({ home: null, canSetHome: true }))).toBe(
    "needsHome",
  );
});

test("the API's canAddVisiting decides the lock, not the rating", () => {
  expect(visitingGate(state({ rating: 12, canAddVisiting: false }))).toBe(
    "locked",
  );
  expect(visitingGate(state({ rating: -1, canAddVisiting: true }))).toBe(
    "open",
  );
});

test("joinable regions skip home and visiting, in selectable order", () => {
  expect(joinableRegions(state({ visiting: [row(3)] }))).toEqual([2, 4]);
});

test("every region joined: the gate is full", () => {
  const s = state({ visiting: [row(2), row(3), row(4)] });
  expect(joinableRegions(s)).toEqual([]);
  expect(visitingGate(s)).toBe("full");
});

test("a known error key is used, anything else is generic", () => {
  const known = (key) => key === "errors.notEligible";
  expect(errorMessageKey({ error: "notEligible" }, known)).toBe(
    "errors.notEligible",
  );
  expect(errorMessageKey({ error: "internal_error" }, known)).toBe(
    "errors.generic",
  );
  expect(errorMessageKey({ error: 3 }, known)).toBe("errors.generic");
  expect(errorMessageKey(null, known)).toBe("errors.generic");
  expect(errorMessageKey("x", known)).toBe("errors.generic");
});

test("positions list only the granted seats, in order", () => {
  expect(
    positionsOf(row(2, { ctr: true, gnd: true, instructor: true })),
  ).toEqual([
    { key: "gnd", label: "GND" },
    { key: "ctr", label: "CTR" },
  ]);
  expect(positionsOf(row(2))).toEqual([]);
});
