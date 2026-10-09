import { describe, expect, test } from "bun:test";
import { buildAtisMakerUrl } from "../src/lib/atis.ts";

describe("ATIS maker URL", () => {
  test("keeps slot A airport macros nested for EuroScope", () => {
    expect(buildAtisMakerUrl("https://ceruleanavi.net", { slot: "A" })).toBe(
      "https://ceruleanavi.net/api/v1/atis?arr=$arrrwy($atisairportA)&dep=$deprwy($atisairportA)&apptype=ILS&info=$atiscodeA&metar=$metar($atisairportA)",
    );
  });
  test("keeps slot B airport macros nested for EuroScope", () => {
    expect(buildAtisMakerUrl("https://ceruleanavi.net/", { slot: "B" })).toBe(
      "https://ceruleanavi.net/api/v1/atis?arr=$arrrwy($atisairportB)&dep=$deprwy($atisairportB)&apptype=ILS&info=$atiscodeB&metar=$metar($atisairportB)",
    );
  });
});
