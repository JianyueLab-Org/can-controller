/**
 * 侧栏是**一份**数据：管制员中心的四个页面，每个管制员都一样，没有评级门槛。
 * 教员与管理页面是 can-portal 的，从外壳的网络切换器进去。
 *
 * 名字是 i18n 的**键**，翻译发生在 `buildNavigation()` 里；链接在 Astro 侧（服
 * 务端）拼好，作为 props 进岛屿。
 */
import type { Translator } from "@/lib/i18n";
import type { IconName, NavItem, SiteOrigins } from "@jianyuelab-org/can-ui";
import { CAN_PORTAL_ORIGIN, CAN_WEB_ORIGIN } from "@/lib/config";

/**
 * 传给 `CanFrame` 的 dev/staging 覆盖。只覆盖这个仓库的
 * `config.ts` 本来就读得到的那两个变量，本地和 staging 上的网络切换器才会
 * 落在对应环境自己的主站/门户，而不是永远指向线上。生产环境这两个变量本来
 * 就是线上地址，所以行为不变。
 */
export const SITE_ORIGINS: SiteOrigins = {
  web: CAN_WEB_ORIGIN,
  portal: CAN_PORTAL_ORIGIN,
};

/**
 * 搬过来的四个页面。
 *
 * 路径去掉了 `/controllers` 前缀 —— 这里整个站就是管制员中心，再套一层等于把
 * 主站的目录结构原样搬到一个只有它自己的域名上。can-efb 拆出去时也是这么做
 * 的（`/pilots/flightplan` → `/flightplan`）。
 *
 * `/` 带斜杠是给 `SidebarNav.isCurrentPath()` 看的：以斜杠结尾的条目只精确匹
 * 配，否则「概览」会在每一个子页面上都亮着。
 */
const PANEL: Array<{ key: string; href: string; icon: IconName }> = [
  { key: "controllers.panel", href: "/", icon: "home" },
  { key: "controllers.atis", href: "/atis", icon: "speakerWave" },
  {
    key: "controllers.reservations",
    href: "/reservations",
    icon: "calendarDays",
  },
  { key: "controllers.rules", href: "/rules", icon: "documentText" },
];

/** 把上面的键解析成当前语言的文案。在 Astro 侧调用，结果作为 props 进岛屿。 */
export function buildNavigation(t: Translator): NavItem[] {
  return PANEL.map((entry) => ({
    name: t(entry.key),
    href: entry.href,
    icon: entry.icon,
  }));
}
