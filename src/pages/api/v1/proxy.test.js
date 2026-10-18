import { afterAll, beforeEach, expect, spyOn, test } from "bun:test";
import { CAN_API_ORIGIN, origin } from "../../../lib/config";

const { GET, POST, DELETE } = await import("./[...path].ts");

const cookie = "can_session=synthetic-session";
const fetchSpy = spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockImplementation(async () => new Response("{}", { status: 200 }));
});

afterAll(() => {
  fetchSpy.mockRestore();
});

function call(handler, method, path, headers = {}) {
  const url = `https://controller.example.com/api/v1/${path}`;
  return handler({
    params: { path },
    request: new Request(url, { method, headers }),
    url: new URL(url),
  });
}

test("GET pilot/divisions is forwarded with the cookie", async () => {
  fetchSpy.mockImplementation(async () => new Response("{}", { status: 203 }));
  const res = await call(GET, "GET", "pilot/divisions", { cookie });
  expect(res.status).toBe(203);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [target, init] = fetchSpy.mock.calls[0];
  expect(target).toBe(CAN_API_ORIGIN + "/api/v1/pilot/divisions");
  expect(new Headers(init.headers).get("cookie")).toBe(cookie);
});

test("POST pilot/divisions from our own origin is forwarded", async () => {
  const res = await call(POST, "POST", "pilot/divisions", {
    cookie,
    origin: origin(),
  });
  expect(res.status).toBe(200);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(fetchSpy.mock.calls[0][0]).toBe(
    CAN_API_ORIGIN + "/api/v1/pilot/divisions",
  );
});

test("POST pilot/divisions from a foreign origin is refused", async () => {
  const res = await call(POST, "POST", "pilot/divisions", {
    cookie,
    origin: "https://evil.example",
  });
  expect(res.status).toBe(403);
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("DELETE pilot/divisions is 405", async () => {
  const res = await call(DELETE, "DELETE", "pilot/divisions", {
    cookie,
    origin: origin(),
  });
  expect(res.status).toBe(405);
  expect(res.headers.get("allow")).toBe("GET, POST");
  expect(fetchSpy).not.toHaveBeenCalled();
});
