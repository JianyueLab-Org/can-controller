/**
 * 从 can-web 的 `src/lib/activities.ts` 里切出来的三样东西，**只有这三样**。
 *
 * 活动本身没有搬过来 —— 活动板、报名、积分、奖品仍然是主站的页面。搬过来的是
 * ATC 预约看板，而它恰好用到了活动那边的两个时间格式化函数和一个门槛常量。
 *
 * 与其为了三个函数把 232 行的活动规则整份抄过来（那份里有积分公式、席位表、
 * 呼号校验，全是这个站永远不会渲染的东西，而且每一条都会和主站慢慢漂移），
 * 不如只搬这三样，并在这里写清楚它们是从哪儿来的。文件名保持 `activities.ts`
 * 是有意的：预约看板那个岛屿是从 can-web 逐字复制过来的，import 路径不动，它
 * 就永远不会因为「搬家时顺手改了个名字」而和上游对不上。
 *
 * Browser-safe：没有服务端依赖，岛屿直接 import。
 */

/**
 * 撤销**他人**预约的门槛（11 = SUP，见主站的 ratingTrans）。
 *
 * UI 从这个常量读，服务端由 can-api 的 `WithSup` / `MinSupRating` 强制 ——
 * 也就是说把这里改小并不会放开任何权限，只会让按钮出现在一个点下去必然 403
 * 的地方。
 */
export const MIN_SUP_RATING = 11;

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Zulu 是网络对外公布时间的口径（带 `Z` 后缀）。
 *
 * 本地时间由浏览器时区自动换算，成员不需要选也不需要心算 —— 两个都摆出来，
 * 写错年份这种手滑一眼就能看见。拼接由词典里的 `timeWithLocal` 完成，避免把
 * 中英文连接词写死在组件里。
 */
export function formatZulu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}Z`;
}

export function formatLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
