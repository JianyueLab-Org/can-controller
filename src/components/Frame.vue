<script setup lang="ts">
/**
 * 本站的网络外壳：can-ui 的 `CanFrame`，`layout="tool"`。
 *
 * 退出登录由 can-ui 的 AccountMenu 发：同源 `POST /api/v1/auth/signout`，反代把
 * can-api 的 Set-Cookie 原样带回（`src/pages/api/v1/[...path].ts`）。之后去 can-web
 * 的 `/`（`afterSignOut="web"`）：这个站整站要登录。
 *
 * `origins`：构建期的 `PUBLIC_CAN_<SITE>_ORIGIN`（`originsFromEnv`），叠上服务端传
 * 进来的运行期覆盖（`SITE_ORIGINS`，`src/lib/nav.ts`）。
 */
import {
  CanFrame,
  originsFromEnv,
  type FrameUser,
  type NavItem,
  type NavSecondary,
  type SiteOrigins,
  type Workspace,
} from "@jianyuelab-org/can-ui";

const props = defineProps<{
  locale: string;
  pathname: string;
  nav: NavItem[];
  secondary?: NavSecondary;
  workspaces?: Workspace[];
  user: FrameUser | null;
  messages: Record<string, unknown>;
  origins?: SiteOrigins;
}>();

const origins: SiteOrigins = {
  ...originsFromEnv(import.meta.env),
  ...props.origins,
};
</script>

<template>
  <CanFrame
    layout="tool"
    current="controller"
    :locale="locale"
    :pathname="pathname"
    :nav="nav"
    :secondary="secondary"
    :workspaces="workspaces"
    active-workspace="controllers"
    :user="user"
    :messages="messages"
    :origins="origins"
    after-sign-out="web"
  >
    <slot />
  </CanFrame>
</template>
