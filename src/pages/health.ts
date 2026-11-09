import type { APIRoute } from "astro";
import { CAN_API_ORIGIN } from "@/lib/config";
import { createHealth, healthResponse, upstreamCheck } from "@/server/health";

export const prerender = false;

/**
 * 外部可用性监控用：探 can-api 的 `/health`。k8s 探针仍然用 `/healthz`，
 * 上游故障不能滚掉本站的 Pod。中间件对它放行（`isUnguarded`）。
 */
const health = createHealth({ "can-api": upstreamCheck(CAN_API_ORIGIN) });

export const GET: APIRoute = async () => healthResponse(await health());
