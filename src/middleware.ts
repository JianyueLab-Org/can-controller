import { defineMiddleware } from "astro:middleware";
import { resolveSession } from "@/server/canApi";
import { signInUrl } from "@/lib/config";

/**
 * 每个请求先问一次 can-api「你是谁」，答案放进 `Astro.locals.user`。
 *
 * **这个站整站都要登录**，所以没有 PROTECTED_PREFIXES 这样一份清单。清单的意
 * 义在于区分公开页和受保护页，而管制员中心一页公开的都没有 —— 这正是它在
 * can-web 上的行为：`/controllers` 整个前缀都在主站的 PROTECTED_PREFIXES 里，
 * 搬家不改变谁能看见什么。
 *
 * 管制规则看起来像是可以公开的那一页，但它在主站上从来就不是，而「顺手把一份
 * 文档改成公开」不属于一次搬家该做的决定。真要开，得在这里显式开一个口子，
 * 而不是默认就开着。
 *
 * 例外只有两条，理由各自写在 `isUnguarded` 上。
 *
 * 重定向去的是 **can-web 的登录页**：这个站自己没有登录页，也不该有。会话由
 * can-api 在父域上签发，主站上登录过的成员到这里本来就带着 cookie。
 * `signInUrl()` 上写着为什么不带 callbackUrl。
 */

/**
 * 不问会话、也不重定向的两条路径。
 *
 * - `/api/` 是本站的反代，它自己有白名单，而且它的调用方要的是状态码不是
 *   302 —— 把一个 fetch 重定向到登录页，岛屿拿到的会是一段 HTML，然后它会试
 *   着把 `<!doctype html>` 当 JSON 解析。
 * - `/healthz` 是探活，理由写在那个文件里：它必须能在 can-api 挂掉时照样回
 *   200，否则上游一抖，kubelet 就会把这边的 Pod 一起滚掉。
 */
function isUnguarded(pathname: string): boolean {
  return pathname.startsWith("/api/") || pathname === "/healthz";
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (isUnguarded(context.url.pathname)) {
    context.locals.user = null;
    return withSecurityHeaders(await next());
  }

  const user = await resolveSession(context);
  context.locals.user = user;

  if (!user) {
    return withSecurityHeaders(context.redirect(signInUrl()));
  }

  return withSecurityHeaders(await next());
});

/**
 * 和几个兄弟站一致的安全头。
 *
 * 用函数包一层而不是在 `next()` 之后就地设置：上面那个重定向是提前返回的，内
 * 联写法会让它成为唯一一个什么头都没有的响应 —— can-web 正是被这一条咬过。
 */
function withSecurityHeaders(response: Response): Response {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "origin-when-cross-origin");
  return response;
}
