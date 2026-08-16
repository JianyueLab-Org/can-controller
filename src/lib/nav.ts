/**
 * 侧栏是**一份**数据，不是每个页面各自拼的一串链接。
 *
 * 它在 can-web 上叫 `ControllersShell.vue`，是一个 Vue 组件；搬过来之后拆成了
 * 「数据在这里、渲染交给 `ui/AppShell.vue`」两半，原因只有一个但很硬：
 *
 * **这个站的一部分链接是跨站的绝对地址**，而那些地址来自环境变量。
 * `src/lib/config.ts` 在模块顶层读 `process.env`，任何被岛屿 import 的模块这么
 * 做都会在浏览器里炸成 `process is not defined`。所以链接在 Astro 侧（服务端）
 * 拼好，作为 props 进岛屿 —— can-efb 出于同一个理由这么做。
 *
 * 名字是 i18n 的**键**，不是文案：翻译发生在 `buildNavigation()` 里，键名一个
 * 字都没改，和 can-web 的 `frame` 命名空间对得上，所以四本词典是从那边整段切
 * 过来的而不是重写的 —— 只是切过来之后又删掉了一批，见下一条。
 *
 * **这个站的侧栏只放管制员的东西。**
 *
 * 搬家的第一版把 can-web 的整条侧栏原样带了过来 —— 教员 / SUP / 管理的入口
 * （`/super/roster`、`/super/promote`、`/super/promotions`、`/super/activities`、
 * `/super/prizes`、`/super/feedback`），以及活动、积分兑换、处理结果公示、问题
 * 与建议这几条面向全体成员的快捷入口。它们当时是**跨站链接**，理由是「菜单还在
 * 原来的位置」。
 *
 * 那条理由不成立：它们没有一条是管制员在这个域名上要做的事。网络的管理面和成员
 * 服务留在主站，成员本来就要回主站去用；在这里复制一份入口，只是把主站的目录结
 * 构又抄了一遍，而且抄的是一份会和主站慢慢对不上的副本。所以现在的规矩是**加一
 * 条之前先回答「管制员在管制的时候用得到它吗」**，答案是否就不加。
 *
 * 删掉的条目连同它们的词条一起从四本词典里去掉了，不是留在那里没人引用：
 * `AppLayout.astro` 把整本 `frame` 词典当 prop 序列化进岛屿，所以一条没人用的
 * 文案是每个页面都要发一遍的字节。
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
 * 把上面的键解析成当前语言的文案。在 Astro 侧调用，结果作为 props 进岛屿。
 *
 * `t` 是 `frame` 命名空间上的翻译器。
 *
 * 这里**不再读 rating**。以前读它是为了决定教员 / SUP / 管理那几项出不出现；那
 * 几项已经不在这个站上了，于是侧栏对每个登录成员都是同一份 —— 权限差异体现在页
 * 面内容里（预约看板上的「撤销他人预约」仍然看 rating，见
 * `pages/reservations.astro`），不再体现在导航上。
 */
export function buildNavigation(t: Translator): NavItem[] {
  return PANEL.map((entry) => ({
    name: t(entry.key),
    href: entry.href,
    icon: entry.icon,
  }));
}

/**
 * 钉在轨底的常用链接。
 *
 * 全部是跨站的，但每一条都先过了上面那道题。留下的四条是管制员在管制的时候真的
 * 会开的：看谁在线上（雷达）、看谁有权限（管制员名册）、装客户端（软件下载）、
 * 查规章（文档）。
 *
 * 它们是钉住的而不是一个「快速访问」折叠菜单 —— can-web 上正是后者，那让最常用
 * 的几条多了两次点击。
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
        name: t("downloads"),
        href: webUrl("/downloads"),
        icon: "arrowDownTray",
      },
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
 * 它**不是**上面那道题的例外，而是根本不在题里：它不是管制员中心的内容，是网络
 * 外壳的一部分 —— 成员从这个域名走出去的唯一一条路。删掉它，离开这个站就只剩下
 * 浏览器的地址栏。
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
