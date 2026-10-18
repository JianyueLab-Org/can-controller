<script setup lang="ts">
/**
 * 概览页上的访问分部卡片：列出成员已加入的访问分部，并在满足条件时加一个新的。
 *
 * 只能加，不能退。can-api 没有移除访问分部的动作，退出和转部由教员处理，所以每次
 * 加入都走一次显式确认。
 *
 * 能不能加由 `GET /api/v1/pilot/divisions` 回的 `canAddVisiting` /
 * `minVisitingRating` 决定，规则在 `visitingGate()`；can-api 在 POST 上强制同一条
 * 规则。
 *
 * 这里从不发 `setHome`。归属分部只在 `HomeDivisionSetup.vue` 里设置。
 *
 * 取代 can-web 已删除的 `/exams/divisions`（`Divisions.vue`）的访问分部那一半。
 */
import { computed, onMounted, ref } from "vue";
import { createTranslator } from "@/lib/i18n";
import {
  errorMessageKey,
  joinableRegions,
  positionsOf,
  visitingGate,
  type DivisionState,
} from "@/lib/divisions";
import {
  AlertBox,
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Icon,
  Select,
  Skeleton,
  ratingShort,
} from "@jianyuelab-org/can-ui";
import { apiFetch } from "@/lib/canApi";

const props = defineProps<{
  /** `divisions` 命名空间。 */
  messages: Record<string, unknown>;
}>();

const emit = defineEmits<{ (e: "saved"): void }>();

const t = createTranslator(props.messages);

const state = ref<DivisionState | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const success = ref<string | null>(null);
const choice = ref<string>("");
/** 待确认的那次加入。非空即确认框打开。 */
const pending = ref<number | null>(null);

const confirmOpen = computed({
  get: () => pending.value !== null,
  set: (open: boolean) => {
    if (!open) pending.value = null;
  },
});

const regionName = (region: number) => t(`regions.${region}`);

const gate = computed(() => (state.value ? visitingGate(state.value) : null));

const options = computed(() =>
  state.value
    ? joinableRegions(state.value).map((region) => ({
        value: region,
        label: regionName(region),
      }))
    : [],
);

const rating = computed(() =>
  state.value ? ratingShort(state.value.minVisitingRating) : "",
);

/** 读一次状态。骨架屏只在第一次加载时出现，加入成功后的重读不卸载卡片。 */
async function load() {
  loadError.value = null;
  try {
    const response = await apiFetch("/api/v1/pilot/divisions");
    if (!response.ok) {
      loadError.value = t("errors.load");
      return;
    }
    const payload = await response.json();
    state.value = payload.data as DivisionState;
  } catch {
    loadError.value = t("errors.load");
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function ask() {
  const region = Number(choice.value);
  if (!region) return;
  error.value = null;
  success.value = null;
  pending.value = region;
}

async function commit() {
  if (pending.value === null || busy.value) return;
  busy.value = true;
  error.value = null;
  success.value = null;

  try {
    const response = await apiFetch("/api/v1/pilot/divisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addVisiting", region: pending.value }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      // can-api 回的是词典里的键；认不出来的退回通用文案。
      error.value = t(errorMessageKey(payload, (key) => t(key) !== key));
      pending.value = null;
      return;
    }

    success.value = t("saved");
    pending.value = null;
    choice.value = "";
    await load();
    emit("saved");
  } catch {
    error.value = t("errors.generic");
    pending.value = null;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Card :title="t('visiting.title')" :subtitle="t('visiting.description')">
    <Skeleton v-if="loading" variant="cards" :count="1" />

    <AlertBox v-else-if="loadError && !state" variant="danger">
      {{ loadError }}
    </AlertBox>

    <div v-else-if="state" class="space-y-4">
      <AlertBox v-if="loadError" variant="danger">{{ loadError }}</AlertBox>
      <AlertBox
        v-if="error"
        variant="danger"
        dismissible
        @dismiss="error = null"
      >
        {{ error }}
      </AlertBox>
      <AlertBox
        v-if="success"
        variant="success"
        dismissible
        @dismiss="success = null"
      >
        {{ success }}
      </AlertBox>

      <ul v-if="state.visiting.length" role="list" class="space-y-2">
        <li
          v-for="row in state.visiting"
          :key="row.region"
          class="flex flex-wrap items-center gap-3 rounded-control bg-surface-sunken p-4"
        >
          <Icon name="globeAlt" class="size-5 shrink-0 text-faint" />
          <span class="font-semibold text-ink">
            {{ regionName(row.region) }}
          </span>
          <Badge :variant="row.status ? 'success' : 'neutral'" size="sm">
            {{ row.status ? t("active") : t("inactive") }}
          </Badge>
          <div class="ml-auto flex flex-wrap gap-1">
            <Badge
              v-for="position in positionsOf(row)"
              :key="position.key"
              variant="neutral"
              size="sm"
            >
              {{ position.label }}
            </Badge>
            <span v-if="!positionsOf(row).length" class="text-xs text-faint">
              {{ t("noPermissions") }}
            </span>
          </div>
        </li>
      </ul>

      <EmptyState
        v-else
        icon="globeAlt"
        compact
        :title="t('visiting.none')"
        :description="t('visiting.noneDescription')"
      />

      <div v-if="gate !== 'full'" class="border-t border-subtle pt-4">
        <div
          v-if="gate === 'needsHome'"
          class="flex items-start gap-2 text-sm text-muted"
        >
          <Icon name="informationCircle" class="mt-0.5 size-4 shrink-0" />
          <p>
            <span class="font-medium text-ink">{{
              t("visiting.needsHome")
            }}</span>
            — {{ t("visiting.needsHomeDescription") }}
          </p>
        </div>

        <div
          v-else-if="gate === 'locked'"
          class="flex items-start gap-2 text-sm text-muted"
        >
          <Icon name="shieldCheck" class="mt-0.5 size-4 shrink-0" />
          <p>
            <span class="font-medium text-ink">
              {{ t("visiting.locked", { rating }) }}
            </span>
            — {{ t("visiting.lockedDescription", { rating }) }}
          </p>
        </div>

        <template v-else-if="gate === 'open'">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div class="flex-1">
              <Select
                v-model="choice"
                name="visiting-division"
                :label="t('visiting.add')"
                :options="options"
                :placeholder="t('home.select')"
              />
            </div>
            <Button
              variant="secondary"
              :disabled="!choice || busy"
              @click="ask"
            >
              <template #icon><Icon name="plus" class="size-4" /></template>
              {{ t("visiting.add") }}
            </Button>
          </div>
          <p class="mt-2 text-xs text-faint">
            {{ t("visiting.permanentNote") }}
          </p>
        </template>
      </div>
    </div>

    <!-- 加入后无法自行退出，走一次显式确认。 -->
    <Dialog
      v-model:open="confirmOpen"
      size="sm"
      :close-label="t('cancel')"
      :title="pending !== null ? regionName(pending) : ''"
    >
      <p class="text-sm leading-relaxed text-muted">
        {{ t("visiting.permanentNote") }}
      </p>
      <template #footer>
        <Button variant="ghost" :disabled="busy" @click="pending = null">
          {{ t("cancel") }}
        </Button>
        <Button :loading="busy" @click="commit">
          {{ t("home.confirm") }}
        </Button>
      </template>
    </Dialog>
  </Card>
</template>
