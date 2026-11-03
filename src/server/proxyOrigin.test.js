import { afterEach, expect, test } from "bun:test";
import { GET, POST, PATCH, DELETE } from "../pages/api/v1/[...path]";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.PUBLIC_ORIGIN;
});

function context(method, origin, path = "auth/signout") {
  const headers = new Headers({ cookie: "can_session=member" });
  if (origin !== undefined) headers.set("origin", origin);
  const url = new URL(`http://internal.test/api/v1/${path}`);
  return {
    request: new Request(url, { method, headers }),
    url,
    params: { path },
    clientAddress: "127.0.0.1",
  };
}

test("cookie writes require configured Origin before forwarding", async () => {
  process.env.PUBLIC_ORIGIN = "https://controller.ceruleanavi.net";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 204 });
  };
  for (const sent of [
    undefined,
    "null",
    "https://evil.ceruleanavi.net",
    "http://internal.test",
  ]) {
    const response = await POST(context("POST", sent));
    expect(response.status).toBe(403);
    expect(calls).toBe(0);
  }
  expect(
    (await POST(context("POST", "https://controller.ceruleanavi.net"))).status,
  ).toBe(204);
  expect(calls).toBe(1);
});

test("PATCH and DELETE require Origin; safe SSR reads stay Origin-less", async () => {
  process.env.PUBLIC_ORIGIN = "https://controller.ceruleanavi.net";
  const calls = [];
  globalThis.fetch = async (_input, init = {}) => {
    calls.push(init);
    return new Response(null, { status: 204 });
  };
  for (const [handler, method, path] of [
    [PATCH, "PATCH", "notifications/member/1"],
    [DELETE, "DELETE", "atc/reservations/1"],
  ]) {
    for (const origin of [undefined, "null", "https://evil.ceruleanavi.net"]) {
      expect((await handler(context(method, origin, path))).status).toBe(403);
    }
    expect(
      (
        await handler(
          context(method, "https://controller.ceruleanavi.net", path),
        )
      ).status,
    ).toBe(204);
  }
  expect(calls).toHaveLength(2);
  expect(
    (await GET(context("GET", undefined, "notifications/unread"))).status,
  ).toBe(204);
  const headers = new Headers(calls[2].headers);
  expect(headers.get("cookie")).toBe("can_session=member");
  expect(headers.has("origin")).toBe(false);
});
