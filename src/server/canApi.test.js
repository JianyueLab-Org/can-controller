import {
  afterAll,
  beforeEach,
  describe,
  expect,
  mock,
  spyOn,
  test,
} from "bun:test";
import { defineMiddleware } from "astro/middleware";
import { CAN_API_ORIGIN, origin } from "../lib/config";
import { resolveSession } from "./canApi";

// Astro's Vite alias is not registered in Bun's unit-test runtime.
mock.module("astro:middleware", () => ({ defineMiddleware }));

const user = {
  username: "synthetic-member",
  name: "Synthetic Member",
  email: "member@example.com",
  rating: 8,
};
const cookie = "can_session=synthetic-session";
const fetchSpy = spyOn(globalThis, "fetch");
const errorSpy = spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  fetchSpy.mockReset();
  errorSpy.mockClear();
});

afterAll(() => {
  fetchSpy.mockRestore();
  errorSpy.mockRestore();
});

function request(path = "/reservations?section=current") {
  return new Request(`https://controller.example.com${path}`, {
    headers: { cookie },
  });
}

async function visit(
  path = "/reservations?section=current",
  initialUser = null,
) {
  const { onRequest } = await import("../middleware");
  const incoming = request(path);
  const setCookie = mock(() => {});
  const deleteCookie = mock(() => {});
  const redirect = mock(
    (location) =>
      new Response(null, { status: 302, headers: { Location: location } }),
  );
  const locals = { user: initialUser };
  const next = mock(async () => new Response("protected content"));
  const context = {
    request: incoming,
    url: new URL(incoming.url),
    locals,
    redirect,
    cookies: { set: setCookie, delete: deleteCookie },
  };
  const response = await onRequest(context, next);
  if (!(response instanceof Response)) throw new Error("Missing response");
  return { response, locals, next, redirect, setCookie, deleteCookie };
}

function expectSecurityHeaders(response) {
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe(
    "origin-when-cross-origin",
  );
}

function expectUnchangedCookies(result) {
  expect(result.response.headers.get("Set-Cookie")).toBeNull();
  expect(result.setCookie).not.toHaveBeenCalled();
  expect(result.deleteCookie).not.toHaveBeenCalled();
}

describe("session resolution", () => {
  test("accepts the authenticated member and forwards the cookie", async () => {
    fetchSpy.mockResolvedValue(Response.json({ user }));
    expect(await resolveSession({ request: request() })).toEqual({
      state: "authenticated",
      user,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(
      `${CAN_API_ORIGIN}/api/v1/auth/session`,
    );
    expect(fetchSpy.mock.calls[0]?.[1]?.headers).toEqual({ cookie });
  });

  test("accepts the enveloped session response", async () => {
    fetchSpy.mockResolvedValue(Response.json({ status: "ok", data: { user } }));
    expect(await resolveSession({ request: request() })).toEqual({
      state: "authenticated",
      user,
    });
  });

  for (const [name, response] of [
    ["explicit anonymous user", () => Response.json({ user: null })],
    [
      "enveloped anonymous user",
      () => Response.json({ status: "ok", data: { user: null } }),
    ],
    ["authentication rejection", () => Response.json({}, { status: 401 })],
    [
      "authentication rejection with null body",
      () => Response.json(null, { status: 401 }),
    ],
    [
      "authentication rejection without JSON",
      () => new Response("", { status: 401 }),
    ],
    [
      "authentication rejection with malformed error metadata",
      () => Response.json({ error: { toString: null } }, { status: 401 }),
    ],
  ]) {
    test(`confirms sign-out for ${name}`, async () => {
      fetchSpy.mockResolvedValue(response());
      expect(await resolveSession({ request: request() })).toEqual({
        state: "signed-out",
      });
    });

    test(`redirects only ${name} to sign-in with the existing callback`, async () => {
      fetchSpy.mockResolvedValue(response());
      const result = await visit();
      expect(result.response.status).toBe(302);
      const location = new URL(result.response.headers.get("Location"));
      expect(location.pathname).toBe("/signin");
      expect(location.searchParams.get("callbackUrl")).toBe(
        `${origin()}/reservations?section=current`,
      );
      expect(result.next).not.toHaveBeenCalled();
      expect(result.locals.user).toBeNull();
      expectUnchangedCookies(result);
      expectSecurityHeaders(result.response);
    });
  }
});

const failures = [
  ...[201, 202, 206].map((status) => ({
    name: `unexpected HTTP ${status} anonymous response`,
    respond: async () => Response.json({ user: null }, { status }),
  })),
  {
    name: "unexpected HTTP 204 response",
    respond: async () => new Response(null, { status: 204 }),
  },
  ...[302, 400, 403, 404, 429, 500, 502, 503, 504].map((status) => ({
    name: `HTTP ${status}`,
    respond: async () =>
      Response.json({ error: "synthetic-failure" }, { status }),
  })),
  {
    name: "transport failure",
    respond: async () => {
      throw new TypeError("Synthetic transport failure");
    },
  },
  {
    name: "timeout",
    respond: async () => {
      throw new DOMException("Synthetic timeout", "TimeoutError");
    },
  },
  { name: "invalid JSON", respond: async () => new Response("{") },
  ...[
    ["missing user", {}],
    ["null body", null],
    ["array body", []],
    ["string body", "invalid"],
    ["number body", 42],
    ["boolean body", false],
    ["null envelope data", { data: null }],
    ["invalid user", { user: false }],
    ["array user", { user: [] }],
    ["empty user", { user: {} }],
    ["invalid rating", { user: { ...user, rating: "12" } }],
    ["missing rating", { user: { ...user, rating: undefined } }],
    ["missing username", { user: { ...user, username: undefined } }],
    ["empty username", { user: { ...user, username: "" } }],
    ["invalid name", { user: { ...user, name: null } }],
    ["invalid email", { user: { ...user, email: null } }],
  ].map(([name, body]) => ({
    name: String(name),
    respond: async () => Response.json(body),
  })),
];

describe("unavailable sessions", () => {
  for (const failure of failures) {
    test(`classifies ${failure.name} as unavailable`, async () => {
      fetchSpy.mockImplementation(failure.respond);
      expect(await resolveSession({ request: request() })).toEqual({
        state: "unavailable",
      });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    test(`returns private retryable 503 without sign-in or content for ${failure.name}`, async () => {
      fetchSpy.mockImplementation(failure.respond);
      const result = await visit();
      expect(result.response.status).toBe(503);
      expect(result.response.headers.get("Retry-After")).toBe("5");
      expect(result.response.headers.get("Cache-Control")).toBe(
        "private, no-store",
      );
      expect(result.response.headers.get("Location")).toBeNull();
      expect(await result.response.text()).toBe("");
      expect(result.locals.user).toBeNull();
      expect(result.redirect).not.toHaveBeenCalled();
      expect(result.next).not.toHaveBeenCalled();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expectUnchangedCookies(result);
      expectSecurityHeaders(result.response);
    });
  }

  test("clears any preexisting local identity before stopping downstream work", async () => {
    fetchSpy.mockResolvedValue(Response.json({}, { status: 503 }));
    const result = await visit("/", user);
    expect(result.locals.user).toBeNull();
    expect(result.response.status).toBe(503);
    expect(result.next).not.toHaveBeenCalled();
    expect(result.redirect).not.toHaveBeenCalled();
    expectUnchangedCookies(result);
  });

  test("the outbound request retains its five-second abort deadline", async () => {
    const timeout = spyOn(AbortSignal, "timeout");
    try {
      fetchSpy.mockImplementation(async (_input, init) => {
        if (!(init?.signal instanceof AbortSignal)) {
          throw new Error("Missing abort signal");
        }
        throw new DOMException("Synthetic timeout", "TimeoutError");
      });
      expect(await resolveSession({ request: request() })).toEqual({
        state: "unavailable",
      });
      expect(timeout).toHaveBeenCalledWith(5_000);
      expect(fetchSpy.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
    } finally {
      timeout.mockRestore();
    }
  });
});

describe("existing middleware behavior", () => {
  for (const rating of [0, 1, 8, 11, 12]) {
    test(`retains authenticated rating ${rating} for downstream permission guards`, async () => {
      const member = { ...user, rating };
      fetchSpy.mockResolvedValue(Response.json({ user: member }));
      const result = await visit();
      expect(result.response.status).toBe(200);
      expect(result.locals.user).toEqual(member);
      expect(result.next).toHaveBeenCalledTimes(1);
      expect(result.redirect).not.toHaveBeenCalled();
      expectUnchangedCookies(result);
      expectSecurityHeaders(result.response);
    });
  }

  for (const path of ["/", "/atis", "/rules", "/reservations"]) {
    test(`${path} still resolves a session before rendering`, async () => {
      fetchSpy.mockResolvedValue(Response.json({ user }));
      const result = await visit(path);
      expect(result.locals.user).toEqual(user);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(result.next).toHaveBeenCalledTimes(1);
      expectSecurityHeaders(result.response);
    });
  }

  for (const path of ["/healthz", "/api/v1/pilot/data"]) {
    test(`${path} still bypasses page session resolution`, async () => {
      const result = await visit(path);
      expect(result.response.status).toBe(200);
      expect(result.locals.user).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result.next).toHaveBeenCalledTimes(1);
      expectSecurityHeaders(result.response);
    });
  }
});
