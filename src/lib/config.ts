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
 * can-portal 的 origin。侧栏里教员那一组和 ADM 那一条指向它。
 *
 * 那四个页面**原本在主站**（`ceruleanavi.net/instr/*` 和 `/super/promotions`），
 * 后来整段搬去了教员与管理门户。主站上留着转发页，所以继续写 `webUrl()` 也到得
 * 了 —— 但那是 301 之后再一次请求，而且会让这个文件一直说着一件不再为真的事。
 *
 * 单独一个变量而不是复用 `CAN_WEB_ORIGIN`：can-dev 当年把两个地址塞进同一个
 * `CAN_ISSUER`，结果是改其中一个的人以为自己改完了。
 */
export const CAN_PORTAL_ORIGIN =
  clean(process.env.CAN_PORTAL_ORIGIN) ||
  clean(import.meta.env.PUBLIC_CAN_PORTAL_ORIGIN) ||
  "https://portal.ceruleanavi.net";

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
 * **现在带 callbackUrl 了。** 从前这里写着「不带」，理由是 can-web 的 `/signin`
 * 只接受站内绝对路径 —— 那是一道防开放重定向的检查，把跨站地址传过去只会被丢
 * 掉、回落到 `/pilots`，于是成员登录完停在主站还得自己走回来。
 *
 * can-web 现在有一份显式白名单（`src/lib/callbackUrl.ts`，配一套只测「必须被拒
 * 的输入」的测试），这个域在名单上。
 */
export function signInUrl(returnTo?: URL): string {
  const base = `${CAN_WEB_ORIGIN}/signin`;
  if (!returnTo) return base;
  // 用 origin() 而不是 returnTo.origin：这个站跑在 TLS 终止的反代后面，请求 URL
  // 的 origin 推出来是 http://，那既配不上 can-web 白名单里的 https://（于是被
  // 拒、回落 /pilots，白做一场），也会把成员从 https 降到 http。
  //
  // 片段（#...）不带：它本来就不会发到服务端。
  const target = `${origin()}${returnTo.pathname}${returnTo.search}`;
  return `${base}?callbackUrl=${encodeURIComponent(target)}`;
}

/** 主站上某个页面的绝对地址。侧栏的跨站链接都由它拼。 */
export function webUrl(path: string): string {
  return `${CAN_WEB_ORIGIN}${path}`;
}

/** 教员与管理门户上某个页面的绝对地址。教员组和 ADM 那条由它拼。 */
export function portalUrl(path: string): string {
  return `${CAN_PORTAL_ORIGIN}${path}`;
}
