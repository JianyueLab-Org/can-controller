import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

/**
 * 各分部的管制规则，服务于 `/rules`。
 *
 * 文件名就是 `src/lib/atcRules.ts` 里的分部 key —— 一个分部只有在它的 MDX 存在
 * 之后才会显示成「已发布」，所以索引页上永远不会出现一条指向不存在文件的链接。
 *
 * can-web 那边这个集合叫同一个名字、装的是同一份文件；训练资料和站点文档两个
 * 集合没有跟过来，它们不是管制规则，仍然住在主站。
 */
const rules = defineCollection({
  loader: glob({ pattern: "**/*.mdx", base: "./src/content/rules" }),
});

export const collections = { rules };
