<script setup lang="ts">
import { reactive } from "vue";
import Icon from "@/components/ui/Icon.vue";

export interface NavChild {
  name: string;
  href: string;
  icon?: string;
}
export interface NavItem {
  name: string;
  href?: string;
  icon: string;
  children?: NavChild[];
}
export interface NavSecondary {
  label: string;
  items: NavChild[];
}

const props = defineProps<{
  navigation: NavItem[];
  pathname: string;
  /**
   * Always-visible links pinned to the bottom of the rail (radar, roster,
   * docs). These used to live inside a collapsed "Quick Access" accordion,
   * which put the most-used cross-links two clicks away.
   */
  secondary?: NavSecondary;
}>();

function isCurrentPath(href?: string): boolean {
  if (!href || href === "#" || href.startsWith("http")) return false;
  // Section roots (trailing slash, e.g. "/pilots/") match exactly so the
  // dashboard link isn't highlighted on every sub-route. Other links match
  // their route and any nested path beneath it.
  if (href.endsWith("/")) {
    return props.pathname === href || props.pathname === href.slice(0, -1);
  }
  if (props.pathname === href) return true;
  if (props.pathname.startsWith(href)) {
    const nextChar = props.pathname[href.length];
    return !nextChar || nextChar === "/";
  }
  return false;
}

function sectionActive(item: NavItem): boolean {
  return (item.children ?? []).some((child) => isCurrentPath(child.href));
}

const openSections = reactive<Record<string, boolean>>({});
for (const item of props.navigation) {
  if (item.children) openSections[item.name] = sectionActive(item);
}
function toggleSection(name: string) {
  openSections[name] = !openSections[name];
}

const baseItem =
  "group flex w-full items-center gap-x-3 rounded-control px-2.5 py-2 text-sm font-medium transition-colors duration-150";
const activeItem = "bg-surface-raised text-airwaysn shadow-card";
const idleItem = "text-muted hover:bg-surface-raised hover:text-ink";
</script>

<template>
  <nav class="flex flex-1 flex-col" aria-label="Sidebar">
    <ul role="list" class="-mx-1 space-y-0.5">
      <li v-for="item in navigation" :key="item.name">
        <!-- Leaf -->
        <a
          v-if="!item.children"
          :href="item.href"
          :aria-current="isCurrentPath(item.href) ? 'page' : undefined"
          :class="[baseItem, isCurrentPath(item.href) ? activeItem : idleItem]"
        >
          <Icon
            :name="item.icon"
            :class="[
              'size-5 shrink-0',
              isCurrentPath(item.href)
                ? 'text-airwaysn'
                : 'text-faint group-hover:text-muted',
            ]"
          />
          <span class="truncate">{{ item.name }}</span>
        </a>

        <!-- Group -->
        <div v-else>
          <button
            type="button"
            :aria-expanded="openSections[item.name]"
            :class="[baseItem, sectionActive(item) ? activeItem : idleItem]"
            @click="toggleSection(item.name)"
          >
            <Icon
              :name="item.icon"
              :class="[
                'size-5 shrink-0',
                sectionActive(item)
                  ? 'text-airwaysn'
                  : 'text-faint group-hover:text-muted',
              ]"
            />
            <span class="truncate">{{ item.name }}</span>
            <Icon
              name="chevronRight"
              :class="[
                'ml-auto size-4 shrink-0 text-faint transition-transform duration-200',
                openSections[item.name] ? 'rotate-90' : '',
              ]"
            />
          </button>

          <ul
            v-if="openSections[item.name]"
            role="list"
            class="mt-0.5 space-y-0.5 pl-4"
          >
            <li v-for="subItem in item.children" :key="subItem.name">
              <a
                :href="subItem.href"
                :aria-current="isCurrentPath(subItem.href) ? 'page' : undefined"
                :class="[
                  'block truncate border-l-2 py-1.5 pl-4 pr-2 text-sm transition-colors duration-150',
                  isCurrentPath(subItem.href)
                    ? 'border-airwaysn font-semibold text-airwaysn'
                    : 'border-[var(--border-subtle)] text-muted hover:border-strong hover:text-ink',
                ]"
              >
                {{ subItem.name }}
              </a>
            </li>
          </ul>
        </div>
      </li>
    </ul>

    <!-- Pinned cross-links -->
    <div v-if="secondary?.items.length" class="mt-auto pt-6">
      <h2
        class="px-2.5 pb-2 text-[0.6875rem] font-semibold uppercase tracking-widest text-faint"
      >
        {{ secondary.label }}
      </h2>
      <ul role="list" class="-mx-1 space-y-0.5">
        <li v-for="item in secondary.items" :key="item.name">
          <a
            :href="item.href"
            :aria-current="isCurrentPath(item.href) ? 'page' : undefined"
            :class="[
              baseItem,
              isCurrentPath(item.href) ? activeItem : idleItem,
            ]"
          >
            <Icon
              v-if="item.icon"
              :name="item.icon"
              :class="[
                'size-4 shrink-0',
                isCurrentPath(item.href)
                  ? 'text-airwaysn'
                  : 'text-faint group-hover:text-muted',
              ]"
            />
            <span class="truncate">{{ item.name }}</span>
          </a>
        </li>
      </ul>
    </div>
  </nav>
</template>
