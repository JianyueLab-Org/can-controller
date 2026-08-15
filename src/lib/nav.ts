/**
 * 侧栏是**一份**数据，不是每个页面各自拼的一串链接。
 *
 * 它在 can-web 上叫 `ControllersShell.vue`，是一个 Vue 组件；搬过来之后拆成了
 * 「数据在这里、渲染交给 `ui/AppShell.vue`」两半，原因只有一个但很硬：
 *
 * **这个站的一半链接现在是跨站的绝对地址**，而那些地址来自环境变量。
 * `src/lib/config.ts` 在模块顶层读 `process.env`，任何被岛屿 import 的模块这么
 * 做都会在浏览器里炸成 `process is not defined`。所以链接在 Astro 侧（服务端）
 * 拼好，作为 props 进岛屿 —— can-efb 出于同一个理由这么做。
 *
 * 名字是 i18n 的**键**，不是文案：翻译发生在 `buildNavigation()` 里，键名一个
 * 字都没改，和 can-web 的 `frame` 命名空间对得上，所以四本词典是从那边整段切
 * 过来的而不是重写的。
 */
import type { Translator } from "@/lib/i18n";
import type { NavItem, NavSecondary } from "@/components/ui/SidebarNav.vue";
import type { Workspace } from "@/components/ui/AppShell.vue";
import { webUrl } from "@/lib/config";

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
const PANEL: Array<{ key: string; href: string; icon: string }> = [
  { key: "controllers.panel", href: "/", icon: "home" },
  { key: "controllers.atis", href: "/atis", icon: "speakerWave" },
  { key: "controllers.rules", href: "/rules", icon: "documentText" },
  {
    key: "controllers.reservations",
    href: "/reservations",
    icon: "calendarDays",
  },
];

/**
 * 教员 / SUP / 管理的入口**没有**跟着搬过来，它们仍然是主站的页面。
 *
 * 这不是漏搬。花名册、晋升审批、活动管理、奖品、反馈处理都不是「管制员自己的
 * 那四件事」—— 它们是网络的管理面，飞行员那一侧也用得到其中几个。搬走它们等
 * 于把主站的 `/super` 掏空一半，而那是另一次搬家该做的决定。
 *
 * 于是这里留下的是**链接**：菜单还在原来的位置，点下去去主站。门槛判断
 * （rating）也照抄 can-web，因为它决定的只是「这个菜单出不出现」；真正的守卫
 * 在 can-api 每条路由上。
 */
const RATING_INSTRUCTOR = 8;
const RATING_SUP = 11;
const RATING_ADMIN = 12;

/**
 * 把上面的键解析成当前语言的文案。在 Astro 侧调用，结果作为 props 进岛屿。
 *
 * `t` 是 `frame` 命名空间上的翻译器。
 */
export function buildNavigation(t: Translator, rating?: number): NavItem[] {
  const has = (min: number) => typeof rating === "number" && rating >= min;

  const items: NavItem[] = PANEL.map((entry) => ({
    name: t(entry.key),
    href: entry.href,
    icon: entry.icon,
  }));

  if (has(RATING_INSTRUCTOR)) {
    items.push({
      name: t("instructors.title"),
      icon: "shieldCheck",
      children: [
        { name: t("instructors.items.roster"), href: webUrl("/super/roster") },
        {
          name: t("instructors.items.promotion"),
          href: webUrl("/super/promote"),
        },
      ],
    });
  }

  // 活动管理是 SUP/ADM（rating >= 11）—— 那是发分的人，因此也是决定这些分能换
  // 什么的人。
  if (has(RATING_SUP)) {
    items.push(
      {
        name: t("activitiesManage"),
        href: webUrl("/super/activities"),
        icon: "calendarDays",
      },
      { name: t("prizesManage"), href: webUrl("/super/prizes"), icon: "gift" },
      {
        name: t("feedbackManage"),
        href: webUrl("/super/feedback"),
        icon: "megaphone",
      },
    );
  }

  if (rating === RATING_ADMIN) {
    items.push({
      name: t("admin.title"),
      icon: "shieldCheck",
      children: [
        { name: t("admin.items.promote"), href: webUrl("/super/promotions") },
      ],
    });
  }

  return items;
}

/**
 * 钉在轨底的常用链接。
 *
 * 全部是跨站的：这个站只有四个页面，成员要回主站看花名册、活动、文档的次数比
 * 在这里翻页还多。藏进折叠菜单等于让最常用的几条多两次点击。
 */
export function buildSecondary(t: Translator): NavSecondary {
  return {
    label: t("controllers.quickAccess.title"),
    items: [
      {
        name: t("controllers.quickAccess.OnlineMap"),
        href: "https://radar.airwaysn.org",
        icon: "mapPin",
      },
      { name: t("atcRoster"), href: webUrl("/roster"), icon: "users" },
      {
        name: t("activities"),
        href: webUrl("/activities"),
        icon: "calendarDays",
      },
      { name: t("rewards"), href: webUrl("/rewards"), icon: "gift" },
      { name: t("feedback"), href: webUrl("/feedback"), icon: "megaphone" },
      {
        name: t("downloads"),
        href: webUrl("/downloads"),
        icon: "arrowDownTray",
      },
      { name: t("support"), href: webUrl("/support"), icon: "inbox" },
      {
        name: t("controllers.quickAccess.DocsRegulations"),
        href: webUrl("/docs"),
        icon: "bookOpen",
      },
    ],
  };
}

/**
 * 顶上的分区切换器。
 *
 * 在 can-web 上这是站内的三个前缀；现在三个分区住在三台主机上，切换器还是同一
 * 个 —— 成员不需要知道哪一段是哪个仓库部署的。管制员这一项指向本站的 `/`，
 * 另外两项是绝对地址。
 */
export function buildWorkspaces(t: Translator): Workspace[] {
  return [
    {
      key: "pilots",
      name: t("workspace.pilots"),
      href: webUrl("/pilots/"),
      icon: "paperAirplane",
    },
    {
      key: "controllers",
      name: t("workspace.controllers"),
      href: "/",
      icon: "signal",
    },
    {
      key: "exams",
      name: t("workspace.exams"),
      href: "https://exam.airwaysn.org",
      icon: "academicCap",
    },
  ];
}
