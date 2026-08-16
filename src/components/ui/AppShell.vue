<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { api } from "@/lib/canApi";
import { createTranslator } from "@/lib/i18n";
import { useOverlay } from "@/lib/useOverlay";
import Icon from "@/components/ui/Icon.vue";
import SidebarNav, {
  type NavItem,
  type NavSecondary,
} from "@/components/ui/SidebarNav.vue";
import ThemeLangControls from "@/components/ui/ThemeLangControls.vue";

export interface Workspace {
  key: string;
  name: string;
  href: string;
  icon: string;
}

const props = withDefaults(
  defineProps<{
    navigation: NavItem[];
    pathname: string;
    messages: Record<string, unknown>;
    userName?: string;
    /** ASN ID, shown in the profile menu. */
    userId?: string;
    locale?: string;
    /** Pinned cross-links at the foot of the rail. */
    secondary?: NavSecondary;
    /** Pilots / Controllers switcher; omitted renders no switcher. */
    workspaces?: Workspace[];
    activeWorkspace?: string;
  }>(),
  { locale: "zh-cn" },
);

const t = createTranslator(props.messages);

const sidebarOpen = ref(false);
const profileOpen = ref(false);
const profileRoot = ref<HTMLElement | null>(null);
const profileButton = ref<HTMLElement | null>(null);

const sidebarPanel = useOverlay(sidebarOpen);

// Up-to-two-letter monogram from the user's name for the avatar.
const initials = computed(() => {
  const parts = (props.userName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
});

/* ---------------------------------------------------------------------------
   Quick nav. The top bar used to hold a search input wired to nothing at all;
   it now filters every reachable panel route and jumps to one, which is the
   only thing there is to search from the client without inventing a new API.
--------------------------------------------------------------------------- */
const searchOpen = ref(false);
const query = ref("");
const highlighted = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);
const searchPanel = useOverlay(searchOpen, { initialFocus: searchInput });

interface FlatNavItem {
  name: string;
  href: string;
  icon: string;
  section?: string;
}

const flatNav = computed<FlatNavItem[]>(() => {
  const items: FlatNavItem[] = [];
  const push = (item: FlatNavItem) => {
    if (item.href && item.href !== "#") items.push(item);
  };

  for (const workspace of props.workspaces ?? []) {
    push({
      name: workspace.name,
      href: workspace.href,
      icon: workspace.icon,
      section: t("workspace.label"),
    });
  }
  for (const item of props.navigation) {
    if (item.href) push({ name: item.name, href: item.href, icon: item.icon });
    for (const child of item.children ?? []) {
      push({
        name: child.name,
        href: child.href,
        icon: item.icon,
        section: item.name,
      });
    }
  }
  for (const item of props.secondary?.items ?? []) {
    push({
      name: item.name,
      href: item.href,
      icon: item.icon ?? "arrowPath",
      section: props.secondary?.label,
    });
  }
  return items;
});

const results = computed(() => {
  const needle = query.value.trim().toLowerCase();
  if (!needle) return flatNav.value;
  return flatNav.value.filter(
    (item) =>
      item.name.toLowerCase().includes(needle) ||
      item.section?.toLowerCase().includes(needle) ||
      item.href.toLowerCase().includes(needle),
  );
});

function openSearch() {
  query.value = "";
  highlighted.value = 0;
  searchOpen.value = true;
}
function closeSearch() {
  searchOpen.value = false;
}
function go(href: string) {
  window.location.href = href;
}
function onSearchKeydown(event: KeyboardEvent) {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    highlighted.value = Math.min(
      highlighted.value + 1,
      results.value.length - 1,
    );
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    highlighted.value = Math.max(highlighted.value - 1, 0);
  } else if (event.key === "Enter") {
    event.preventDefault();
    const target = results.value[highlighted.value];
    if (target) go(target.href);
  }
  // Escape is handled by useOverlay, which also restores focus to the trigger.
}

function onGlobalKeydown(event: KeyboardEvent) {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (searchOpen.value) closeSearch();
    else openSearch();
  } else if (event.key === "Escape" && profileOpen.value) {
    profileOpen.value = false;
    profileButton.value?.focus();
  }
}
function onGlobalClick(event: MouseEvent) {
  if (!profileRoot.value?.contains(event.target as Node)) {
    profileOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("keydown", onGlobalKeydown);
  document.addEventListener("click", onGlobalClick);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onGlobalKeydown);
  document.removeEventListener("click", onGlobalClick);
});

function handleSignOut() {
  // Clearing the cookie is can-api's job — it owns the attributes, and a
  // Set-Cookie that does not match the original leaves the browser holding
  // both. The reload is ours, and happens either way: a member who pressed
  // sign out should not stay on a signed-in page because the call failed.
  api("/api/v1/auth/signout", { method: "POST" }).finally(() => {
    window.location.assign("/");
  });
}
</script>

<template>
  <div class="bg-surface">
    <!-- Keyboard users land here first and can jump the whole rail. -->
    <a
      href="#main-content"
      class="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60]"
    >
      {{ t("skipToContent") }}
    </a>

    <!-- Mobile sidebar -->
    <div
      v-if="sidebarOpen"
      class="relative z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      :aria-label="t('openSidebar')"
    >
      <div
        class="animate-overlay-in fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        @click="sidebarOpen = false"
      ></div>
      <div class="fixed inset-0 flex">
        <div
          ref="sidebarPanel"
          class="animate-drawer-in relative mr-16 flex w-full max-w-xs flex-1"
          tabindex="-1"
        >
          <div class="absolute left-full top-0 flex w-16 justify-center pt-5">
            <button
              type="button"
              class="-m-2.5 p-2.5 text-white/80 transition-colors hover:text-white"
              :aria-label="t('closeSidebar')"
              @click="sidebarOpen = false"
            >
              <Icon name="xMark" class="size-6" />
            </button>
          </div>
          <div
            class="flex grow flex-col gap-y-4 overflow-y-auto overscroll-contain border-r border-subtle bg-surface px-5 pb-4"
          >
            <div class="flex h-16 shrink-0 items-center">
              <a href="/" class="-m-1.5 p-1.5">
                <img
                  alt="Cerulean Aviation Network"
                  src="/logo-full.png"
                  class="h-10 w-auto"
                />
              </a>
            </div>

            <!-- Workspace switcher -->
            <div
              v-if="workspaces?.length"
              role="group"
              :aria-label="t('workspace.label')"
              class="flex gap-1 rounded-control bg-surface-sunken p-1"
            >
              <a
                v-for="workspace in workspaces"
                :key="workspace.key"
                :href="workspace.href"
                :aria-current="
                  workspace.key === activeWorkspace ? 'true' : undefined
                "
                :class="[
                  'flex-1 truncate rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-center text-xs font-semibold transition-colors',
                  workspace.key === activeWorkspace
                    ? 'bg-surface-raised text-airwaysn shadow-card'
                    : 'text-muted hover:text-ink',
                ]"
              >
                {{ workspace.name }}
              </a>
            </div>

            <SidebarNav
              :navigation="navigation"
              :pathname="pathname"
              :secondary="secondary"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop sidebar -->
    <div
      class="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col"
    >
      <div
        class="flex grow flex-col gap-y-4 overflow-y-auto border-r border-subtle bg-surface-sunken px-5 pb-4"
      >
        <div class="flex h-16 shrink-0 items-center">
          <a href="/" class="-m-1.5 p-1.5">
            <img
              alt="Cerulean Aviation Network"
              src="/logo-full.png"
              class="h-10 w-auto"
            />
          </a>
        </div>

        <!-- Workspace switcher. Crossing between the pilot, controller and
             exam sections used to mean expanding a collapsed "Quick Access"
             group — or, for exams, was not possible at all. Labels only: at
             three segments an icon leaves no room for the CJK labels. -->
        <div
          v-if="workspaces?.length"
          role="group"
          :aria-label="t('workspace.label')"
          class="flex gap-1 rounded-control bg-surface p-1"
        >
          <a
            v-for="workspace in workspaces"
            :key="workspace.key"
            :href="workspace.href"
            :aria-current="
              workspace.key === activeWorkspace ? 'true' : undefined
            "
            :class="[
              'flex-1 truncate rounded-[calc(var(--radius-control)-2px)] px-2 py-1.5 text-center text-xs font-semibold transition-colors',
              workspace.key === activeWorkspace
                ? 'bg-surface-raised text-airwaysn shadow-card'
                : 'text-muted hover:text-ink',
            ]"
          >
            {{ workspace.name }}
          </a>
        </div>

        <SidebarNav
          :navigation="navigation"
          :pathname="pathname"
          :secondary="secondary"
        />
      </div>
    </div>

    <!-- Main column. Full-height flex column so the footer below settles at
         the bottom of the viewport on short pages instead of mid-screen. -->
    <div class="flex min-h-dvh flex-col lg:pl-72">
      <div class="sticky top-0 z-40 border-b border-subtle bg-chrome">
        <div
          class="mx-auto flex h-16 max-w-7xl items-center gap-x-3 px-4 sm:gap-x-4 sm:px-6 lg:px-8"
        >
          <button
            type="button"
            class="-ml-2 inline-flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-sunken hover:text-ink lg:hidden"
            :aria-label="t('openSidebar')"
            :aria-expanded="sidebarOpen"
            @click="sidebarOpen = true"
          >
            <Icon name="bars3" class="size-6" />
          </button>

          <!-- Quick nav trigger. Icon-only on a phone — as a labelled pill it
               refused to shrink and squeezed the menu button to 27px. -->
          <button
            type="button"
            class="flex size-10 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-surface-sunken hover:text-ink sm:h-9 sm:w-auto sm:min-w-0 sm:flex-1 sm:shrink sm:max-w-xs sm:justify-start sm:gap-2 sm:border sm:border-subtle sm:bg-surface-sunken sm:px-3 sm:text-sm sm:text-faint sm:hover:border-strong sm:hover:text-muted"
            :aria-label="t('search.label')"
            @click="openSearch"
          >
            <Icon name="magnifyingGlass" class="size-5 shrink-0 sm:size-4" />
            <span class="hidden truncate sm:inline">{{
              t("search.placeholder")
            }}</span>
            <kbd
              class="ml-auto hidden shrink-0 rounded border border-subtle bg-surface-raised px-1.5 py-0.5 font-mono text-[0.625rem] text-faint sm:block"
            >
              ⌘K
            </kbd>
          </button>

          <div class="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <ThemeLangControls :locale="locale" />

            <div ref="profileRoot" class="relative">
              <button
                ref="profileButton"
                type="button"
                class="flex items-center gap-2 rounded-control p-1.5 transition-colors hover:bg-surface-sunken"
                :aria-expanded="profileOpen"
                aria-haspopup="menu"
                @click="profileOpen = !profileOpen"
              >
                <span class="sr-only">Open user menu</span>
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-full bg-airwaysn text-xs font-semibold text-white"
                >
                  {{ initials }}
                </span>
                <span
                  class="hidden max-w-32 truncate text-sm font-semibold text-ink lg:block"
                >
                  {{ userName }}
                </span>
                <Icon
                  name="chevronDown"
                  :class="[
                    'size-4 text-faint transition-transform duration-200',
                    profileOpen ? 'rotate-180' : '',
                  ]"
                />
              </button>

              <div
                v-if="profileOpen"
                role="menu"
                class="absolute right-0 z-10 mt-2 w-56 origin-top-right overflow-hidden rounded-card border border-subtle bg-surface-overlay py-1 shadow-popover"
              >
                <div class="border-b border-subtle px-4 py-3">
                  <p class="truncate text-sm font-semibold text-ink">
                    {{ userName }}
                  </p>
                  <p v-if="userId" class="mt-0.5 font-mono text-xs text-faint">
                    #{{ userId }}
                  </p>
                </div>
                <!-- 「用户统计」跟着 can-web 的外壳一起被复制了过来，指向
                     `/pilots/status`。它有两个毛病，各自都足以删掉它：那是飞行
                     员那一侧的页面，不是管制员在这个域名上要做的事；而且这个相
                     对地址在 controller.airwaysn.org 上根本不存在，点下去是本站
                     的 404，不是主站的那一页。 -->
                <button
                  type="button"
                  role="menuitem"
                  class="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-muted transition-colors hover:bg-surface-sunken hover:text-danger"
                  @click="handleSignOut"
                >
                  <Icon name="arrowRightOnRectangle" class="size-4" />
                  {{ t("signOut") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main id="main-content" tabindex="-1" class="flex-1 py-8 lg:py-10">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <slot />
        </div>
      </main>

      <!-- The authenticated panels sit outside Footer.astro (that one is for
           the public pages), so the attribution is repeated here rather than
           shared — an .astro component cannot render inside a Vue island. -->
      <footer class="border-t border-subtle">
        <div
          class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8"
        >
          <p class="text-sm text-faint">
            &copy; 2025 Cerulean Aviation Network. All rights reserved.
          </p>
          <p class="text-sm text-faint">
            Powered by
            <a
              href="https://jianyuelab.org"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-block py-1 font-semibold text-muted transition-colors hover:text-airwaysn"
            >
              JianyueLab
            </a>
          </p>
        </div>
      </footer>
    </div>

    <!-- Quick nav palette -->
    <div
      v-if="searchOpen"
      class="fixed inset-0 z-50 flex items-start justify-center px-4 pt-16 sm:pt-24"
      role="dialog"
      aria-modal="true"
      :aria-label="t('search.label')"
    >
      <div
        class="animate-overlay-in fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
        @click="closeSearch"
      ></div>
      <div
        ref="searchPanel"
        class="animate-panel-in relative w-full max-w-lg overflow-hidden rounded-card border border-subtle bg-surface-overlay shadow-popover"
        tabindex="-1"
      >
        <div class="flex items-center gap-3 border-b border-subtle px-4">
          <Icon name="magnifyingGlass" class="size-5 shrink-0 text-faint" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="quicknav-results"
            :placeholder="t('search.placeholder')"
            :aria-label="t('search.label')"
            class="h-12 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-sm"
            @keydown="onSearchKeydown"
            @input="highlighted = 0"
          />
          <button
            type="button"
            class="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-control text-faint transition-colors hover:text-ink"
            aria-label="Close"
            @click="closeSearch"
          >
            <Icon name="xMark" class="size-5" />
          </button>
        </div>

        <ul
          v-if="results.length"
          id="quicknav-results"
          role="listbox"
          class="max-h-[50dvh] overflow-y-auto overscroll-contain p-2 sm:max-h-80"
        >
          <li
            v-for="(item, index) in results"
            :key="item.href"
            role="option"
            :aria-selected="index === highlighted"
          >
            <button
              type="button"
              tabindex="-1"
              :class="[
                'flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left text-sm transition-colors',
                index === highlighted
                  ? 'bg-surface-sunken text-ink'
                  : 'text-muted hover:bg-surface-sunken hover:text-ink',
              ]"
              @mouseenter="highlighted = index"
              @click="go(item.href)"
            >
              <Icon :name="item.icon" class="size-4 shrink-0 text-faint" />
              <span class="truncate font-medium">{{ item.name }}</span>
              <span v-if="item.section" class="truncate text-xs text-faint">
                {{ item.section }}
              </span>
              <Icon
                name="arrowRight"
                class="ml-auto size-4 shrink-0 text-faint"
              />
            </button>
          </li>
        </ul>
        <p v-else class="px-4 py-8 text-center text-sm text-muted">
          {{ t("search.noResults") }}
        </p>
      </div>
    </div>
  </div>
</template>
