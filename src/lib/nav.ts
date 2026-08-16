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
 * **这个站的侧栏只放管制员的东西 —— 而管制员分教员和普通两类。**
 *
 * 搬家的第一版把 can-web 的整条侧栏原样带了过来，理由是「菜单还在原来的位置」。
 * 那条理由不成立：加一条之前要先回答**「管制员在管制的时候用得到它吗」**，答案
 * 是否就不加 —— 在这里复制一份入口，只是把主站的目录结构又抄了一遍，抄的还是一
 * 份会和主站慢慢对不上的副本。据此去掉的是 SUP / 管理那几项（`/super/promotions`、
 * `/super/activities`、`/super/prizes`、`/super/feedback`）和活动、积分兑换、处
 * 理结果公示、问题与建议这几条面向全体成员的服务：它们是网络的管理面，飞行员那
 * 一侧也用得到，留在主站。
 *
 * **教员那一组不在此列，它过了那道题。** 教员是管制员的一种，花名册和晋升是他
 * 带学员时要做的事，不是网络的管理面 —— 所以它属于管制员中心。**但它只对教员出
 * 现**：普通管制员的侧栏里没有这一组，见 `RATING_INSTRUCTOR`。
 *
 * 收起来的是**菜单**，不是页面：那两页仍然是主站的，各自有 can-web 的守卫和
 * can-api 的路由守卫。这里少一项不等于那一页被保护起来了，多一项也不等于放开了
 * 什么 —— 门槛写在这里只是为了不给普通管制员看一组他点下去必然被拒的链接。
 *
 * 去掉的条目连同它们的词条一起从四本词典里去掉了，不是留在那里没人引用：
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
 * 两道门槛，都照抄 can-web 的 `ratingTrans`：8 及以上是教员（I1/I2/I3），12 是
 * ADM。上面那四个页面每个管制员都有；这两行是这个站上仅有的按身份改变导航的地方。
 *
 * **ADM 这条是 `===` 而不是 `>=`，和 can-web 逐字相同。** 今天两种写法结果一样，
 * 因为 12 就是最高的一级；哪天 `ratingTrans` 上面再加一级，`===` 会让那一级看不
 * 到晋升审批。改它之前先去改 can-web —— 两边对同一个菜单给出不同答案，比这个菜
 * 单本身错了更难查。
 */
const RATING_INSTRUCTOR = 8;
const RATING_ADMIN = 12;

/**
 * 教员那一组，和 ADM 那一组。四条都是**主站的**页面 —— 搬过来的只有菜单，不是
 * 页面本身。
 *
 * 晋升审批和「晋升」分开，是因为它们是同一条流程的两端：教员提，ADM 批。合成一
 * 组会让一个只有 I1 的人以为自己按得动那个按钮。
 *
 * **两组的前缀不一样，这不是笔误。** 主站把教员那三页从 `/super` 拆到了
 * `/instr`：`super` 读作「监理」（SUP，等级 11），而花名册、晋升、SweatBox 是教
 * 员（等级 8）的活。晋升审批留在 `/super`，它确实要 ADM。主站上三条旧地址有重定
 * 向接着，所以写错也不会立刻坏 —— 但那意味着写错了也发现不了，改这里之前先去看
 * `can-web/src/components/StaffShell.vue`，那是同一份菜单的另一半。
 */
const INSTRUCTOR: Array<{ key: string; path: string }> = [
  { key: "instructors.items.roster", path: "/instr/roster" },
  { key: "instructors.items.promotion", path: "/instr/promote" },
  // SweatBox 场景生成器。过了那道题：教员要带学员上模拟机，这是他备课时开的东
  // 西，和花名册、晋升同一类 —— 不是网络的管理面。页面在主站。
  { key: "instructors.items.sweatbox", path: "/instr/sweatbox" },
];

const ADMIN: Array<{ key: string; path: string }> = [
  { key: "admin.items.promote", path: "/super/promotions" },
];

/**
 * 把上面的键解析成当前语言的文案。在 Astro 侧调用，结果作为 props 进岛屿。
 *
 * `t` 是 `frame` 命名空间上的翻译器；`rating` 来自会话（`Astro.locals.user`），
 * can-api 每个请求都解一次，所以一次晋升在下一次翻页时就生效，而不是等到下次登
 * 录。
 *
 * **rating 缺失时按普通管制员处理**，而不是按教员 —— 一个读不出等级的会话应该
 * 看到更少的东西而不是更多。`isInstructor` 里那个 `typeof` 判断就是为了这个：
 * `undefined >= 8` 本来就是 `false`，但写成 `rating! >= 8` 等于把这件事交给运气。
 * ADM 那一条用的是 `===`，缺失时天然落空。
 */
export function buildNavigation(t: Translator, rating?: number): NavItem[] {
  const items: NavItem[] = PANEL.map((entry) => ({
    name: t(entry.key),
    href: entry.href,
    icon: entry.icon,
  }));

  const group = (titleKey: string, entries: typeof INSTRUCTOR): NavItem => ({
    name: t(titleKey),
    icon: "shieldCheck",
    children: entries.map((entry) => ({
      name: t(entry.key),
      href: webUrl(entry.path),
    })),
  });

  if (typeof rating === "number" && rating >= RATING_INSTRUCTOR) {
    items.push(group("instructors.title", INSTRUCTOR));
  }
  if (rating === RATING_ADMIN) {
    items.push(group("admin.title", ADMIN));
  }

  return items;
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
