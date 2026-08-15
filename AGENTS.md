# AGENTS.md

给在这个仓库里工作的人和模型看的。`CLAUDE.md` 是指向本文件的软链接。

## 这是什么

**管制员中心** —— `controller.airwaysn.org`，Cerulean Aviation Network 的第五个
卫星站点。它是从 can-web 的 `/controllers/*` 整段搬出来的，搬的是**四个页面**：

| 这里                      | 原来在 can-web                  | 岛屿                  |
| ------------------------- | ------------------------------- | --------------------- |
| `/`                       | `/controllers/`                 | `Dashboard.vue`       |
| `/atis`                   | `/controllers/atis`             | `AtisMaker.vue`       |
| `/rules`、`/rules/<分部>` | `/controllers/rules/*`          | 纯 Astro + MDX        |
| `/reservations`           | `/controllers/atc-reservations` | `AtcReservations.vue` |

路径去掉了 `/controllers` 前缀 —— 这里整个站就是管制员中心，再套一层等于把主站
的目录结构原样搬到一个只有它自己的域名上。can-efb 拆出去时也是这么做的
（`/pilots/flightplan` → `/flightplan`）。

技术形状和 can-efb / can-dev / can-radar 一样，**不要在这里发明第六套**：Astro
SSR（standalone Node 适配器）+ Vue 岛屿 + Tailwind v4，跑在 jyl-tyo 上，由 CI 部
署，Ingress 走 `cloudflare-tunnel`。

## 三条不变量

**没有数据库口令。** 一条都没有，将来也不该有。所有数据都来自 can-api。

**没有 Secret，一个都没有。** 和 can-efb 一样，比 can-dev 更严：这个站不参与
OAuth，也不签会话。会话是 can-api 签在**父域** `.airwaysn.org` 上的那一枚
cookie，成员在主站登录过，浏览器本来就把它带到这里来；这个站做的全部事情是把它
**原样转发**回 can-api，再读回答案。多存一份 `SESSION_SECRET` 等于多一处能签发任
何人身份的地方，省下的只是一次内网 HTTP。

如果哪天有人要在 `deploy/k8s.yaml` 里加一个 Secret，先确认那件事真的不能靠转发
cookie 完成。

**没有自己的登录页。** 未登录一律 302 去主站的 `/signin`（`src/lib/config.ts` 的
`signInUrl()` 上写着为什么不带 `callbackUrl`）。

## 搬过来的和没搬过来的

**搬过来了：** 上表那四个页面，以及它们要的 lib（`atis.ts` 的 METAR 解析与 ATIS
文本生成、`atcReservations.ts` 的窗口校验、`atcRules.ts` 的分部文档索引）、
`src/content/rules/` 下的规则文档、以及整套设计系统（`src/components/ui/`、
`src/styles/globals.css`、`src/components/icons.ts`）。

**没搬：** 教员 / SUP / 管理的那几个入口（`/super/roster`、`/super/promote`、
`/super/promotions`、`/super/activities`、`/super/prizes`、`/super/feedback`）。
它们不是「管制员自己的那四件事」—— 花名册、活动、奖品、反馈都是网络的管理面，飞
行员那一侧也用得到其中几个。侧栏里它们仍在原来的位置，但那是**跨站链接**，点下去
去主站。搬走它们等于把主站的 `/super` 掏空一半，那是另一次搬家该做的决定。

考试中心（can-exam）、雷达（can-radar）、EFB（can-efb）本来就在别的站点上，侧栏
顶部的分区切换器把它们连起来。

## 接缝

### 岛屿 → can-api：走本站的同源反代

`src/lib/canApi.ts` 导出 `api` / `apiFetch` / `unwrapList`，**签名和 can-web 的
同名文件一模一样**。这不是巧合：三个岛屿是从 can-web 逐字复制过来的，接口对齐
了它们就不用重写 —— 重写意味着重新犯一遍 `unwrapList` 注释里记着的那三个错
（`data` 有时是数组、有时包在一个名字下面，读错了页面会在渲染中途抛
`.filter is not a function`，看起来像页面坏了而不是响应读错了；**ATC 预约看板正
是这么上线过的**）。

唯一的差别：这里打的是**同源**的 `/api/v1/...`，由
`src/pages/api/v1/[...path].ts` 转给 can-api，而不是直连 `api.airwaysn.org`。
理由和 can-efb、can-radar 一样 —— can-api 的 `ALLOWED_ORIGINS` 里没有这个域，加
进去要改它的部署环境变量并重启。同源反代让这个站今天就能跑，一行 can-api 都不用
动。

**那份白名单是重点，不是修饰。** 一个通配的 `/api/*` 转发等于重建当年拆掉的网
关。每一条都写着谁在用它。要加页面就要加条目 —— 而且要顺手把「谁在用」写清楚，
否则以后没人敢删任何一条。

### 第一次进来：没有归属分部就先选分部

概览页（`/`）在成员**还没有归属分部**时，渲染的不是概览而是一道门
（`src/components/HomeDivisionSetup.vue`）。这是这个站相对 can-web 唯一一处**行为**
上的改动，不是搬家的副作用：

- can-web 上，「没有归属分部」表现为概览上一张写着「未分配」的统计卡，夹在另外两
  张有数字的卡中间 —— 看起来像一条状态，不像一件待办。
- 而真正能设置它的界面在**考试中心**的一个设置页上（`/exams/divisions`），一个新
  管制员没有理由会走到那里去。
- 在那之前，这一页上几乎每一格都是空的：席位权限由分部授予，培训由归属分部的教员
  安排，管制时长是 0。所以在设置完成之前不渲染概览的其余部分，不是在藏东西 ——
  那些部分此刻没有内容。

这个写入**不可逆**（归属分部只能自己设一次，之后的转部要教员来做），所以它和
can-web 的 `Divisions.vue` 一样走一次显式确认，且确认框里重复一遍「设置后无法自行
更改」。文案共用 `divisions` 那一批词条，只有「第一次」的那几句在 `setup` 里。

它**不读** `/api/v1/pilot/divisions` 的 GET —— 那条 GET 回的 `canSetHome` 定义就是
「还没有归属分部」，而概览页已经从 `pilot/data` 知道了。所以转发白名单里那一条只
开了 POST；`ALLOW_LIST` 先于 `ALLOW_PATTERNS` 查也因此从「顺手」变成了**必须**，
否则这个 POST 会被 `pilot/<id>` 那条只允许 GET 的模式判成 405。

### 会话与 rating

`src/middleware.ts` 每个请求向 can-api 解一次会话，结果放进 `Astro.locals.user`。
**整站要登录**，所以没有 `PROTECTED_PREFIXES` 那样一份清单，只有两个例外
（`/api/*` 和 `/healthz`，理由写在 `isUnguarded` 上）。

侧栏里教员 / SUP / 管理那几项出不出现，取决于会话里的 `rating`。**这是便利，不是
边界。** 真正的判断在 can-api 每条路由自己的守卫上；把门槛改小只会让菜单多出几个
点下去必然 403 的链接。

### ATIS maker URL 指向主站，不是本站

`src/pages/atis.astro` 传给岛屿的 `origin` 是 `CAN_WEB_ORIGIN`
（`https://airwaysn.org`），不是本站。两个各自独立的理由，那个文件上写全了：

1. `/api/v1/atis` 对外的地址在**主站的转发白名单**里，而那条 URL 已经被一批管制
   员粘进各自机器上的 EuroScope 了。改掉它等于让那些人下次上线时 ATIS 静默失
   效，两边的 CI 谁也发现不了。
2. `Astro.url.origin`（can-web 那边传的东西）在这个部署里本来就是错的：TLS 在
   Cloudflare 那侧终止，从 `Host` 头推出来的是 `http://`。

### `checkOrigin` 必须是关的

`astro.config.mjs` 里 `security.checkOrigin: false`。Astro 从 `Host` 头推导本站
origin 再和浏览器的 `Origin` 比对，而这个站跑在 TLS 终止的反代后面，推出来的是
`http://…`、浏览器发的是 `https://…`，**永远对不上，每一个 POST 都是 403** ——
在这里那意味着「开一条预约」和「退出登录」全都失败，报的错还指向不了任何地方。
can-dev、can-radar、can-efb 都是踩了才关的。

关掉不等于不检查：写操作的 Origin 比对显式配置的 `PUBLIC_ORIGIN`，见
`src/pages/api/v1/[...path].ts`，那个值反代动不了。

## 和 can-web 共享的那些文件

`src/components/ui/*`、`src/components/icons.ts`、`src/styles/globals.css`、
`src/lib/i18n.ts`、`src/lib/useOverlay.ts`、`src/lib/atis.ts`、
`src/lib/atcReservations.ts`、`src/lib/divisions.ts` 以及三个岛屿，都是从 can-web
**逐字复制**的，没有抽成包。

这是有意的，和三个卫星站点各自抄 `config.ts` 是同一个理由：几个站各自部署、各自
有自己的节奏，绑成一个包意味着改主站的一个按钮圆角会顺手改掉这里。代价是它们会
慢慢漂移，所以：**改动这些文件之前，先去 can-web 看一眼那边是什么样**，如果是通
用的修复，两边都改。

`src/styles/globals.css` 保持和 can-web 逐字一致（连那段用不上的 Leaflet 覆盖样
式也留着），这样 `diff` 一下就能看出有没有漂移。

`src/lib/activities.ts` 是个例外：它只切了三样东西（`MIN_SUP_RATING`、
`formatZulu`、`formatLocal`），文件名保持不变是为了让预约看板那个岛屿的 import
路径一个字都不用改。文件顶上写着这件事。

四本词典（`language/*.json`）里，下面这些命名空间是从 can-web 的对应文件里**整段
切**出来的，键名一个字没改：`frame` / `controllers` / `atis` /
`atcReservations` / `divisions` / `common` / `notFound`。所以往回同步一条翻译，是
从 can-web 那边把同名的那一段拷过来，而不是手改。

**`setup` 是例外，它是这个站自己的。** can-web 上没有对应的键，因为那边根本没有
「第一次」这个概念 —— 见上面的〈第一次进来：没有归属分部就先选分部〉。改它不用去
看 can-web。

## 本地开发

```bash
bun install
bun run dev            # :4326
bun run lint           # format:check + astro check + vue-tsc —— CI 就跑这一条
bun run build
```

端口 4326 是接着那条阶梯排的：4321 can-web、4322 can-dev、4323 can-radar、
4324 can-efb、4325 can-exam。

本地跑要给 `PUBLIC_ORIGIN`，否则写操作的 Origin 检查会拿线上地址去比对本地的
`http://localhost:4326`：

```bash
PUBLIC_ORIGIN=http://localhost:4326 bun run dev
```

`CAN_API_ORIGIN` 和 `CAN_WEB_ORIGIN` 默认就是线上地址，所以开着本地站点也能读到
真实数据（读的是你自己那枚 cookie —— 前提是浏览器上有 `.airwaysn.org` 的会话，
`localhost` 上没有，所以本地看到的多半是 302 去登录页）。要连本地的 can-api 就把
两个变量都指过去。

## 上线之前

1. 把 `controller.airwaysn.org` 接进 Cloudflare 隧道，确认 can-api 的会话 cookie
   域覆盖 `.airwaysn.org`。
2. **在 can-web 上给 `/controllers/*` 加转向。** 这一步不能省：那四个地址在成员
   的书签、Discord 的置顶和各分部自己的文档里躺了很久，这个仓库里没有任何东西通
   知得到它们。
3. **不要**把这个域加进 can-api 的 `ALLOWED_ORIGINS`。浏览器从不直连 can-api，
   那正是同源反代存在的理由。
