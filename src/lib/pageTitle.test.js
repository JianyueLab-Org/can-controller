import { expect, test } from "bun:test";
import { pageTitle } from "./pageTitle";

test("page · site, localised", () => {
  expect(pageTitle("ATIS Maker", "en-us")).toBe(
    "ATIS Maker · Controller Centre",
  );
  expect(pageTitle("ATIS 生成器", "zh-cn")).toBe("ATIS 生成器 · 管制员中心");
});

test("root page is the site name alone", () => {
  expect(pageTitle(undefined, "ja-jp")).toBe("管制官センター");
});

test("unknown locale falls back to English", () => {
  expect(pageTitle(undefined, "xx")).toBe("Controller Centre");
});
