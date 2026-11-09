import { expect, test } from "bun:test";
import { createHealth, healthResponse, upstreamCheck } from "./health";

test("200 when every check passes", async () => {
  const res = healthResponse(await createHealth({ a: async () => {} })());
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ status: "ok", checks: { a: "ok" } });
});

test("503 when upstream answers non-2xx", async () => {
  const fetchImpl = async () => new Response("x", { status: 500 });
  const res = healthResponse(
    await createHealth({ "can-api": upstreamCheck("http://u", fetchImpl) })(),
  );
  expect(res.status).toBe(503);
  expect(await res.json()).toEqual({
    status: "fail",
    checks: { "can-api": "HTTP 500" },
  });
});

test("caches for 10 s and shares in-flight checks", async () => {
  let calls = 0;
  let t = 0;
  const health = createHealth({ a: async () => void calls++ }, () => t);
  await Promise.all([health(), health()]);
  expect(calls).toBe(1);
  t = 9_999;
  await health();
  expect(calls).toBe(1);
  t = 10_000;
  await health();
  expect(calls).toBe(2);
});
