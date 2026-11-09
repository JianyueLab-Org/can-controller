/**
 * `/health` 的检查逻辑：给外部可用性监控用，探 can-api 的 `/health`。
 *
 * 每项检查 3 秒超时；整体结果按进程缓存 10 秒，刷新期间的并发请求共用同一次检查。
 */

export type HealthCheck = () => Promise<void>;
export type HealthResult = {
  status: "ok" | "fail";
  checks: Record<string, string>;
};

const CHECK_TIMEOUT_MS = 3_000;
const CACHE_TTL_MS = 10_000;

/** 上游 `/health` 非 2xx 即失败。 */
export function upstreamCheck(
  origin: string,
  fetchImpl: typeof fetch = fetch,
): HealthCheck {
  return async () => {
    const res = await fetchImpl(origin + "/health", {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    await res.body?.cancel();
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  };
}

function shortError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError")
      return "timeout";
    if (error.message.startsWith("HTTP ")) return error.message;
  }
  return "unreachable";
}

export function createHealth(
  checks: Record<string, HealthCheck>,
  now: () => number = Date.now,
): () => Promise<HealthResult> {
  let cached: { at: number; result: HealthResult } | null = null;
  let inflight: Promise<HealthResult> | null = null;

  async function run(): Promise<HealthResult> {
    const entries = await Promise.all(
      Object.entries(checks).map(
        async ([name, check]): Promise<[string, string]> => {
          try {
            await check();
            return [name, "ok"];
          } catch (error) {
            console.warn(`health check ${name} failed: ${String(error)}`);
            return [name, shortError(error)];
          }
        },
      ),
    );
    const result: HealthResult = {
      status: entries.every(([, v]) => v === "ok") ? "ok" : "fail",
      checks: Object.fromEntries(entries),
    };
    cached = { at: now(), result };
    return result;
  }

  return () => {
    if (cached && now() - cached.at < CACHE_TTL_MS)
      return Promise.resolve(cached.result);
    inflight ??= run().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}

export function healthResponse(result: HealthResult): Response {
  return new Response(JSON.stringify(result), {
    status: result.status === "ok" ? 200 : 503,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
