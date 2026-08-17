/**
 * 这个站要知道的三个地址，集中在一处。
 *
 * 和 can-efb 的同名文件几乎一样，是有意抄的而不是抽包共用：几个卫星站点各自
 * 部署、各自有自己的默认值，把它们绑成一个包意味着改 EFB 的默认端口会顺手改
 * 掉管制员中心的。
 *
 * can-dev 当年把 can-api 的地址和同意页的地址塞进同一个 `CAN_ISSUER`，结果是
 * 改其中一个的人以为自己改完了。这里从一开始就分开命名。
 */

function clean(value: string | undefined): string {
  return (value || "").replace(/\/+$/, "");
}

/**
 * can-api 的 origin。数据全部来自它。
 *
 * `PUBLIC_` 前缀让 Astro 把它内联进客户端包 —— 它是主机名，不是密钥。但**浏
 * 览器其实用不到它**：岛屿走本站的同源反代（见
 * `src/pages/api/v1/[...path].ts`），那样就不需要 can-api 那边为
 * controller.ceruleanavi.net 开一条 CORS。真正用它的是 SSR 和那个反代。
 *
 * 兜底成生产地址而不是空串：can-web 的 `src/server/canApi.ts` 记着这一条的代
 * 价 —— 空串在浏览器里能解析成同源相对地址，在服务端却是 `ERR_INVALID_URL`，
 * 而且每一个请求都失败，日志看起来像是 can-api 挂了，其实只是没人设过这个
 * 变量。
 */
export const CAN_API_ORIGIN =
  clean(process.env.CAN_API_ORIGIN) ||
  clean(import.meta.env.PUBLIC_CAN_API_ORIGIN) ||
  "https://api.ceruleanavi.net";

/**
 * can-web 的 origin。指登录页，以及那些**没有**跟着管制员搬过来的页面。
 *
 * 管制员中心自己没有登录页，也不该有：会话由 can-api 签在父域上，主站上登录过
 * 的成员到这里本来就带着 cookie。
 *
 * 侧栏底部那一排跨站链接也走它 —— 花名册、活动、奖励、反馈、支持、文档全都还
 * 在主站，这个站只搬走了「管制员自己的那四件事」。
 */
export const CAN_WEB_ORIGIN =
  clean(process.env.CAN_WEB_ORIGIN) ||
  clean(import.meta.env.PUBLIC_CAN_WEB_ORIGIN) ||
  "https://ceruleanavi.net";

/**
 * 本站自己的 origin，写操作的 Origin 头要和它比对。
 *
 * 必须是**显式配置**的值，不能从 `Host` 头推：这个站跑在 TLS 终止的反代后面，
 * 推出来的是 `http://…`，浏览器发的是 `https://…`，永远对不上。
 * `astro.config.mjs` 里关掉 `checkOrigin` 正是这个原因，而这里是补上的那一半。
 */
export function origin(): string {
  return (
    clean(process.env.PUBLIC_ORIGIN) ||
    clean(import.meta.env.PUBLIC_ORIGIN) ||
    "https://controller.ceruleanavi.net"
  );
}

/**
 * 登录去哪儿。
 *
 * **不带 callbackUrl。** can-web 的 `/signin` 只接受站内绝对路径
 * （`/^\/(?!\/)/`），那是一道防开放重定向的检查，把
 * `https://controller.ceruleanavi.net/...` 传过去只会被丢掉、回落到 `/pilots`。
 * 要让成员登录完回到这里，得先在 can-web 那边显式放行这个域 —— 那是一处对钓鱼
 * 很敏感的改动，属于 can-web 的评审范围，不该在这里偷偷绕过去。
 */
export function signInUrl(): string {
  return `${CAN_WEB_ORIGIN}/signin`;
}

/** 主站上某个页面的绝对地址。侧栏的跨站链接都由它拼。 */
export function webUrl(path: string): string {
  return `${CAN_WEB_ORIGIN}${path}`;
}
