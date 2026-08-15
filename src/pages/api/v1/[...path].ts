import type { APIRoute } from "astro";
import { CAN_API_ORIGIN, origin } from "@/lib/config";

export const prerender = false;

/**
 * 走白名单的 can-api 反代。
 *
 * **为什么有这一层，而不是让岛屿直接打 api.airwaysn.org。** can-web 是直连
 * 的，因为 `airwaysn.org` 写在 can-api 的 `ALLOWED_ORIGINS` 里；管制员中心这
 * 个域没写，加进去要改 can-api 的部署环境变量并重启。同源反代让这个站**今天**
 * 就能跑，一行 can-api 都不用动 —— can-radar 代理 `/track` 和 `/metar`、
 * can-efb 代理它那一组，都是同一个理由。
 *
 * 顺带解决的两件事：浏览器不需要 CORS，会话 cookie 也不必跨站 travel（它在父
 * 域上，本来就会跟着同源请求过来，再由这里转发）。
 *
 * **白名单是重点，不是修饰。** 一个通配的 `/api/*` 转发等于在这里重建一遍当年
 * 拆掉的网关：任何人都能拿这个站当跳板去打 can-api 的 super/staff 接口，而那
 * 些接口的鉴权虽然自己也会拦，但一个可以任意转发的开放代理迟早会被当成别的东
 * 西用。每一条都写清楚谁在用。
 *
 * 鉴权本身**不在这里判**。can-api 每条路由自己有守卫，在这里再抄一份只会有两
 * 份可能不一致的判断 —— 这一层只管「这个路径允许被转发吗」，以及写操作的
 * Origin。预约看板上那个「撤销他人预约」按钮尤其要读这一句：按钮出不出现由
 * rating 决定，能不能成功由 can-api 决定，这里两件事都不掺和。
 */

interface Allowed {
  /** 允许的方法。 */
  methods: string[];
  /** 谁在用它 —— 没有这一句，以后没人敢删任何一条。 */
  who: string;
}

/** 精确匹配的路径。 */
const ALLOW_LIST: Record<string, Allowed> = {
  // 外壳：账户区、退出按钮。
  "auth/session": { methods: ["GET"], who: "Shell.vue / middleware" },
  "auth/signout": { methods: ["POST"], who: "AppShell 退出登录" },

  // 概览：成员自己的资料（席位权限、分部、等级）。
  "pilot/data": { methods: ["GET"], who: "Dashboard.vue" },

  // ATIS 制作器要的实时 METAR。
  //
  // 走的是 `controller/metar` 而不是公开的 `metar`：前者是 can-api 给管制端的
  // 那一条，AtisMaker 从 can-web 搬过来时用的就是它，改成另一条等于在搬家的同
  // 时换掉数据源。
  "controller/metar": { methods: ["GET"], who: "AtisMaker.vue" },

  // ATC 预约看板：读板、开一条、以及（下面的模式）撤销一条。
  "atc/reservations": { methods: ["GET", "POST"], who: "AtcReservations.vue" },
};

/**
 * 带一个动态段的路径。
 *
 * 精确白名单表达不了 `/api/v1/pilot/<ASN ID>` 这种形状，而概览页确实要按 ID
 * 读自己的管制时长。正则是**收紧的**而不是 `.*`：一个 `[^/]+` 就足以让
 * `pilot/../super/xxx` 这类东西有讨论余地，而这里根本不给它机会。
 *
 * 顺序上精确表先查 —— `pilot/data` 会被下面第一条也匹配上，但它有自己的条目，
 * 谁在用它写得更清楚。
 */
const ALLOW_PATTERNS: Array<Allowed & { test: RegExp }> = [
  {
    test: /^pilot\/[A-Za-z0-9_-]{1,32}$/,
    methods: ["GET"],
    who: "Dashboard.vue 读自己的管制统计",
  },
  {
    test: /^atc\/reservations\/[0-9]{1,20}$/,
    methods: ["DELETE"],
    who: "AtcReservations.vue 撤销一条预约",
  },
];

function lookup(path: string): Allowed | undefined {
  return ALLOW_LIST[path] ?? ALLOW_PATTERNS.find((entry) => entry.test.test(path));
}

const UNSAFE = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * 逐字转发给 can-api 的响应头。
 *
 * `set-cookie` **必须**在里面：退出登录是 can-api 用一个 Set-Cookie 清掉会话
 * 的，漏掉它成员就永远登不出去。
 */
const PASS_THROUGH = ["content-type", "cache-control", "set-cookie"];

const handler: APIRoute = async (context) => {
  const rest = context.params.path ?? "";
  const entry = lookup(rest);

  if (!entry) {
    return Response.json(
      { error: "not_allowed", message: "该接口不在此站的转发白名单内。" },
      { status: 404 },
    );
  }

  const method = context.request.method.toUpperCase();
  if (!entry.methods.includes(method)) {
    return Response.json(
      { error: "method_not_allowed", message: "方法不被允许。" },
      { status: 405, headers: { allow: entry.methods.join(", ") } },
    );
  }

  // 写操作的 Origin 检查 —— Astro 的 checkOrigin 关掉了（反代下它永远误判，见
  // astro.config.mjs），这是补上的那一半。缺 Origin 头的请求放行：非浏览器的
  // 调用方本来就不带它，而它们要过的是 can-api 的守卫，不是这一关。
  if (UNSAFE.has(method)) {
    const sent = context.request.headers.get("origin");
    if (sent && sent !== origin()) {
      return Response.json(
        { error: "bad_origin", message: "跨站请求被拒绝。" },
        { status: 403 },
      );
    }
  }

  const target = CAN_API_ORIGIN + "/api/v1/" + rest + context.url.search;

  const headers = new Headers();
  const cookie = context.request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const contentType = context.request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body:
        method === "GET" || method === "HEAD"
          ? undefined
          : context.request.body,
      // body 是流，Node 的 fetch 要求显式声明才肯发。
      ...(method === "GET" || method === "HEAD" ? {} : { duplex: "half" }),
      signal: AbortSignal.timeout(15_000),
    } as RequestInit);
  } catch (error) {
    console.error(`can-api ${rest} unreachable:`, error);
    return Response.json(
      { error: "unreachable", message: "无法连接到 can-api，请稍后再试。" },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers: out });
};

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
