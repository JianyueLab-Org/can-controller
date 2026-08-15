<script setup lang="ts">
/**
 * 第一次进管制员中心时的那一步：选归属分部。
 *
 * **为什么这是一道门，而不是概览页上的一行「未分配」。** 没有归属分部的成员，
 * 这个站上几乎每一格都是空的 —— 席位权限是空的（权限由分部授予）、课程是空的
 * （培训由归属分部的教员安排）、管制时长是 00:00:00。can-web 上它表现为一张写
 * 着「未分配」的统计卡，夹在另外两张有数字的卡中间，看起来像一条状态而不像一件
 * 待办；真正的选择入口在**考试中心**的一个设置页上（`/exams/divisions`），一个
 * 新管制员没有理由会走到那里去。所以这里把它提到最前面，并且在设置完成之前不渲
 * 染概览的其余部分 —— 那些部分此刻没有内容可显示。
 *
 * **这个写操作是不可逆的。** 归属分部只能自己设一次，之后的转部要教员来做（见
 * can-api 的 `internal/api/pilot.go`：`setHome` 在 home 非空时答 `homeLocked`）。
 * 所以它和 can-web 的 `Divisions.vue` 一样走一次显式确认，而且确认框里重复一遍
 * 「设置后无法自行更改」——文案是同一批词条，不是新写的。
 *
 * **不读 `/api/v1/pilot/divisions`。** 那条 GET 会回一个 `canSetHome`，而它的定
 * 义就是 `home == nil`（同一个文件，第 233 行）—— 概览页已经从
 * `/api/v1/pilot/data` 知道 `homeDivision` 是空的，再问一次只是把同一个事实换个
 * 地方读，代价是这道门上多一个加载态和多一种失败方式。可选项来自本地的
 * `SELECTABLE_REGIONS`，规则由 can-api 在 POST 上强制。
 */
import { computed, ref } from "vue";
import { createTranslator } from "@/lib/i18n";
import { SELECTABLE_REGIONS } from "@/lib/divisions";
import AlertBox from "@/components/ui/AlertBox.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseCard from "@/components/ui/BaseCard.vue";
import BaseDialog from "@/components/ui/BaseDialog.vue";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import Icon from "@/components/ui/Icon.vue";
import { apiFetch } from "@/lib/canApi";

const props = defineProps<{
  /** `divisions` 命名空间 —— 和 can-web 的选分部界面共用同一批词条。 */
  messages: Record<string, unknown>;
  /** `setup` 命名空间 —— 只有这个站有的「第一次」那几句。 */
  setupMessages: Record<string, unknown>;
}>();

const emit = defineEmits<{ (e: "saved"): void }>();

const t = createTranslator(props.messages);
const ts = createTranslator(props.setupMessages);

const choice = ref<string>("");
const busy = ref(false);
const error = ref<string | null>(null);
/** 待确认的那次写入。非空即确认框打开。 */
const pending = ref<number | null>(null);

const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (open: boolean) => {
    if (!open) pending.value = null;
  },
});

const regionName = (region: number) => t(`regions.${region}`);

const options = computed(() =>
  SELECTABLE_REGIONS.map((region) => ({
    value: region,
    label: regionName(region),
  })),
);

const reasons = [
  { key: "permissions", icon: "shieldCheck" },
  { key: "training", icon: "academicCap" },
  { key: "once", icon: "exclamationTriangle" },
] as const;

function ask() {
  const region = Number(choice.value);
  if (!region) return;
  error.value = null;
  pending.value = region;
}

async function commit() {
  if (pending.value === null || busy.value) return;
  busy.value = true;
  error.value = null;

  try {
    const response = await apiFetch("/api/v1/pilot/divisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setHome", region: pending.value }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      // can-api 回的是词典里的键，不是一句话 —— 这样这条消息在这里按当前语言
      // 渲染，而不是由服务端用某一种语言发过来。认不出来的键退回通用文案。
      const key = payload?.error;
      const translated =
        typeof key === "string" && t(`errors.${key}`) !== `errors.${key}`
          ? t(`errors.${key}`)
          : null;
      error.value = translated ?? t("errors.generic");
      return;
    }

    pending.value = null;
    // 概览页自己重新拉一次 /api/v1/pilot/data。这里不 reload 整页：会话、外壳
    // 和侧栏都没变，要变的只是这一份数据。
    emit("saved");
  } catch {
    error.value = t("errors.generic");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl py-4 sm:py-8">
    <BaseCard padding="lg">
      <div class="flex flex-col items-center text-center">
        <span
          class="flex size-14 items-center justify-center rounded-full bg-warning-bg text-warning-fg"
        >
          <Icon name="mapPin" class="size-7" />
        </span>
        <h1 class="mt-5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {{ ts("title") }}
        </h1>
        <p class="mt-3 max-w-lg text-muted">{{ ts("description") }}</p>
      </div>

      <ul role="list" class="mt-7 space-y-3 border-t border-subtle pt-6">
        <li
          v-for="reason in reasons"
          :key="reason.key"
          class="flex items-start gap-3 text-sm text-muted"
        >
          <Icon :name="reason.icon" class="mt-0.5 size-5 shrink-0 text-faint" />
          <span>{{ ts(`reasons.${reason.key}`) }}</span>
        </li>
      </ul>

      <AlertBox
        v-if="error"
        variant="danger"
        dismissible
        class="mt-6"
        @dismiss="error = null"
      >
        {{ error }}
      </AlertBox>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div class="flex-1">
          <BaseSelect
            v-model="choice"
            name="home-division"
            :label="t('home.select')"
            :options="options"
            :placeholder="t('home.select')"
          />
        </div>
        <BaseButton size="lg" :disabled="!choice || busy" @click="ask">
          {{ t("home.save") }}
        </BaseButton>
      </div>

      <AlertBox variant="warning" class="mt-4">
        {{ t("home.permanentWarning") }}
      </AlertBox>
    </BaseCard>

    <!-- 不可逆的写入，走一次显式确认。 -->
    <BaseDialog
      v-model:open="confirmOpen"
      size="sm"
      :close-label="t('cancel')"
      :title="
        pending !== null
          ? t('home.confirmTitle', { division: regionName(pending) })
          : ''
      "
    >
      <p class="text-sm leading-relaxed text-muted">
        {{ t("home.permanentWarning") }}
      </p>
      <template #footer>
        <BaseButton variant="ghost" :disabled="busy" @click="pending = null">
          {{ t("cancel") }}
        </BaseButton>
        <BaseButton :loading="busy" @click="commit">
          {{ t("home.confirm") }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
