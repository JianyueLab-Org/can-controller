// @ts-check
import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import node from "@astrojs/node";
import vue from "@astrojs/vue";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";

/**
 * 管制员中心。和 can-web / can-dev / can-radar / can-efb 同一套形状：Astro SSR
 * （standalone Node 适配器）+ Vue 岛屿 + Tailwind v4。第五个站不要自己再发明一
 * 套构建。
 *
 * `output: "server"` 是必需的而不是预留：这个站整站要登录，每个页面渲染前都要
 * 拿会话 cookie 去问 can-api「你是谁」，预渲染的页面拿不到 cookie。
 *
 * `security.checkOrigin: false` 的理由和另外四个站逐字相同：Astro 从 `Host` 头
 * 推导本站 origin 再和浏览器的 `Origin` 比对，而这个站跑在 TLS 终止的反代后面，
 * 推出来的是 `http://…`、浏览器发的是 `https://…`，**永远对不上**，于是每一个
 * POST 都是 403 —— 在这里那意味着「开一条预约」和「退出登录」全都失败，而且报
 * 的错指向不了任何地方。关掉不等于不检查：写操作的 Origin 要比对显式的
 * `PUBLIC_ORIGIN`，见 `src/pages/api/v1/[...path].ts`，那个值反代动不了。
 */

/**
 * 给每一张 markdown 表格套一个可横向滚动的容器。
 *
 * 从 can-web 原样搬过来，因为管制规则文档正是需要它的那一类：JPN 管制规则里有
 * 十几张三四列的日文表格，比手机屏幕宽。没有自己的容器，表格会把**文章**撑宽，
 * 于是整页横向滚动 —— 页面上每一个标题和段落都跟着偏，而不只是那张表。
 *
 * 必须是包一层元素，而不是给 table 本身 `display: block; overflow: auto` 那个
 * 更短的 CSS 写法：改 table 的 `display` 会把它的 `table` role 从无障碍树上摘
 * 掉，屏幕阅读器就失去了行列导航 —— 偏偏是在规则索引这种「表格就是内容」的文
 * 档上。配套的样式是 `src/styles/globals.css` 里的 `.table-scroll`。
 *
 * 手写而不是引 `unist-util-visit`：一共十几行，而另一条路是依赖一个目前只是
 * Astro markdown 管线传递依赖的包。
 *
 * 节点形状就地写出来而不是从 `hast` import，理由相同 —— 这个文件是 `@ts-check`
 * 的，从一个没人声明的包里借类型，是配置在一次无关升级里坏掉的经典方式。
 *
 * @typedef {{ type: string, tagName?: string, properties?: Record<string, unknown>, children?: HastNode[] }} HastNode
 */
function rehypeScrollableTables() {
  /** @param {HastNode} tree */
  return (tree) => {
    /** @param {HastNode} node */
    const walk = (node) => {
      if (!Array.isArray(node.children)) return;
      for (const child of node.children) walk(child);
      node.children = node.children.map((child) =>
        child.type === "element" && child.tagName === "table"
          ? {
              type: "element",
              tagName: "div",
              properties: { className: ["table-scroll"] },
              children: [child],
            }
          : child,
      );
    };
    walk(tree);
  };
}

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [vue(), mdx()],
  // `markdown.rehypePlugins` is the deprecated spelling — the pipeline is
  // configured by handing `markdown.processor` a `unified()` instance instead.
  // `@astrojs/markdown-remark` is pinned to the exact version astro itself
  // resolves so both end up on one module: astro identifies its own processor
  // by instance, not by shape, and two copies means the plugin silently does
  // nothing.
  markdown: { processor: unified({ rehypePlugins: [rehypeScrollableTables] }) },
  security: { checkOrigin: false },
  vite: {
    plugins: [tailwindcss()],

    /**
     * can-ui 发的是**源码**（`.vue` / `.ts` / `.css`）而不是构建产物。代价是必须
     * 告诉 Vite 不要把它当外部依赖：不加这行，SSR 会去 `require` 一个 `.vue`
     * 文件，首屏直接 500。
     */
    ssr: { noExternal: ["@jianyuelab-org/can-ui"] },
  },
});
