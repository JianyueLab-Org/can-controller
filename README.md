# can-controller

Cerulean Aviation Network 的**管制员中心** —— `controller.airwaysn.org`。

从 can-web 的 `/controllers/*` 拆出来的独立站点，四个页面：

- `/` —— 管制员概览：席位权限、等级、分部、管制时长
- `/atis` —— ATIS 生成器：拉 METAR、生成 ATIS 文本、生成粘进 EuroScope 的
  ATIS maker URL
- `/rules` —— 各分部的管制规则
- `/reservations` —— ATC 席位预约看板

Astro SSR + Vue 岛屿 + Tailwind v4。**不持有数据库口令，也不持有任何 Secret**：
数据全部来自 can-api，会话是 can-api 签在父域上的那一枚 cookie，这个站只转发它。

## 开发

```bash
bun install
bun run dev                                  # http://localhost:4326
PUBLIC_ORIGIN=http://localhost:4326 bun run dev   # 写操作要它
bun run lint                                 # CI 的门，一字不差
bun run build
```

## 环境变量

| 变量             | 默认值                            | 用途                                          |
| ---------------- | --------------------------------- | --------------------------------------------- |
| `CAN_API_ORIGIN` | `https://api.airwaysn.org`        | 数据层。SSR 和同源反代都打它                  |
| `CAN_WEB_ORIGIN` | `https://airwaysn.org`            | 登录页、侧栏跨站链接、ATIS maker URL 的主机名 |
| `PUBLIC_ORIGIN`  | `https://controller.airwaysn.org` | 写操作的 Origin 比对基准，**必须显式配置**    |

三个都不是密钥，容器里以明文环境变量传（`deploy/k8s.yaml`）。

## 部署

推到 `main` 触发 CI：构建镜像推 `ghcr.io/jianyuelab-org/can-controller`，然后
`kubectl apply -f deploy/k8s.yaml` 到 jyl-tyo 的 `can-controller` namespace。
Ingress 走 `cloudflare-tunnel`，TLS 在 Cloudflare 那侧终止 —— 所以清单里没有
cert-manager 注解，也没有 `tls:` 块。

更深的东西（接缝、不变量、哪些文件是从 can-web 复制的、上线前要做什么）看
[`AGENTS.md`](./AGENTS.md)。
