<script setup lang="ts">
/**
 * EuroScope ATIS maker.
 *
 * Fetches a METAR by ICAO (via /api/v1/controller/metar), then renders a live
 * ATIS preview with the very same `@/lib/atis` the public /api/v1/atis endpoint
 * uses — so the preview is exactly what EuroScope will speak. It also builds the
 * parameterised URL a controller pastes into EuroScope's "ATIS maker URL" field.
 */
import { computed, ref } from "vue";
import { createTranslator } from "@/lib/i18n";
import {
  ATIS_SLOTS,
  buildAtisMakerUrl,
  describeClouds,
  formatAtis,
  parseMetar,
  phonetic,
  splitRunways,
  type AtisSlot,
  type ParsedWind,
} from "@/lib/atis";
import AlertBox from "@/components/ui/AlertBox.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseCard from "@/components/ui/BaseCard.vue";
import BaseInput from "@/components/ui/BaseInput.vue";
import BaseSelect from "@/components/ui/BaseSelect.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import Icon from "@/components/ui/Icon.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { apiFetch } from "@/lib/canApi";

const props = defineProps<{
  messages: Record<string, unknown>;
  origin: string;
}>();
const t = createTranslator(props.messages);

const icao = ref("");
const info = ref("A");
const approach = ref("ILS");
const arr = ref("");
const dep = ref("");
const tl = ref("");
const remarks = ref("");
/** Which of EuroScope's four ATIS slots the URL's macros are keyed to. */
const slot = ref<string>("A");

const metarRaw = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const copied = ref<"url" | "text" | null>(null);

const infoOptions = Array.from({ length: 26 }, (_, k) => {
  const c = String.fromCharCode(65 + k);
  return { value: c, label: `${c} — ${phonetic(c)}` };
});
const approachOptions = ["ILS", "RNAV", "VOR", "NDB", "LOC", "VISUAL"].map(
  (v) => ({
    value: v,
    label: v,
  }),
);
const slotOptions = ATIS_SLOTS.map((v) => ({ value: v, label: v }));

const parsed = computed(() =>
  metarRaw.value ? parseMetar(metarRaw.value) : null,
);

const atisOptions = computed(() => ({
  icao: icao.value.trim().toUpperCase() || undefined,
  info: info.value,
  arrRunways: splitRunways(arr.value),
  depRunways: splitRunways(dep.value),
  approach: approach.value,
  transitionLevel: tl.value,
  remarks: remarks.value,
}));

const preview = computed(() =>
  parsed.value ? formatAtis(parsed.value, atisOptions.value).text : "",
);

const makerUrl = computed(() =>
  buildAtisMakerUrl(props.origin, {
    approach: approach.value,
    slot: slot.value as AtisSlot,
  }),
);

function windChip(w?: ParsedWind): string {
  if (!w) return "—";
  if (w.calm) return "Calm";
  const dir = w.variable ? "VRB" : `${String(w.degrees).padStart(3, "0")}°`;
  const gust = w.gust ? `G${w.gust}` : "";
  return `${dir} ${w.speed}${gust}${w.unit}`;
}

const decoded = computed(() => {
  const m = parsed.value;
  if (!m) return [];
  const vis = m.cavok
    ? "CAVOK"
    : (m.visibilityText ??
      (m.visibilityMeters === undefined
        ? "—"
        : m.visibilityMeters >= 10000
          ? "≥10km"
          : m.visibilityMeters % 1000 === 0
            ? `${m.visibilityMeters / 1000}km`
            : `${m.visibilityMeters}m`));
  const temp =
    m.temperature !== undefined && m.dewpoint !== undefined
      ? `${m.temperature}°C / ${m.dewpoint}°C`
      : "—";
  const qnh =
    m.qnhHpa !== undefined
      ? `${m.qnhHpa} hPa`
      : m.qnhInHg !== undefined
        ? `${m.qnhInHg.toFixed(2)} inHg`
        : "—";
  return [
    { label: t("fields.wind"), value: windChip(m.wind) },
    { label: t("fields.visibility"), value: vis },
    { label: t("fields.clouds"), value: describeClouds(m) },
    {
      label: t("fields.weather"),
      value: m.weather.length ? m.weather.join(", ") : "—",
    },
    { label: t("fields.temp"), value: temp },
    { label: t("fields.qnh"), value: qnh },
  ];
});

async function fetchMetar() {
  const id = icao.value.trim().toUpperCase();
  icao.value = id;
  if (!/^[A-Z]{4}$/.test(id)) {
    error.value = t("errors.invalidIcao");
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const res = await apiFetch(`/api/v1/controller/metar?icao=${id}`);
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      error.value =
        payload?.error === "notFound"
          ? t("errors.notFound", { icao: id })
          : t("errors.fetch");
      return;
    }
    metarRaw.value = payload.data.raw as string;
  } catch {
    error.value = t("errors.fetch");
  } finally {
    loading.value = false;
  }
}

async function copy(value: string, which: "url" | "text") {
  try {
    await navigator.clipboard.writeText(value);
    copied.value = which;
    setTimeout(() => {
      if (copied.value === which) copied.value = null;
    }, 1500);
  } catch {
    /* clipboard blocked — no-op */
  }
}
</script>

<template>
  <div>
    <PageHeader
      :title="t('title')"
      :description="t('description')"
      icon="speakerWave"
    />

    <AlertBox
      v-if="error"
      variant="danger"
      dismissible
      class="mb-6"
      @dismiss="error = null"
    >
      {{ error }}
    </AlertBox>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Left: weather + configuration -->
      <div class="space-y-6">
        <BaseCard :title="t('weather.title')" :subtitle="t('weather.subtitle')">
          <form
            class="flex flex-col gap-3 sm:flex-row sm:items-end"
            @submit.prevent="fetchMetar"
          >
            <div class="flex-1">
              <BaseInput
                v-model="icao"
                name="icao"
                :label="t('icao.label')"
                :placeholder="t('icao.placeholder')"
                :hint="t('icao.hint')"
                :maxlength="4"
                autocomplete="off"
              />
            </div>
            <BaseButton type="submit" :loading="loading">
              <template #icon
                ><Icon name="magnifyingGlass" class="size-4"
              /></template>
              {{ loading ? t("fetching") : t("fetch") }}
            </BaseButton>
          </form>

          <template v-if="parsed">
            <div class="mt-4 rounded-control bg-surface-sunken p-3">
              <p
                class="mb-1 text-xs font-medium uppercase tracking-wide text-faint"
              >
                {{ t("metar.raw") }}
              </p>
              <p class="break-words font-mono text-sm text-ink">
                {{ metarRaw }}
              </p>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div
                v-for="item in decoded"
                :key="item.label"
                class="rounded-control bg-surface-sunken p-3"
              >
                <p class="text-xs uppercase tracking-wide text-faint">
                  {{ item.label }}
                </p>
                <p class="mt-0.5 text-sm font-medium text-ink">
                  {{ item.value }}
                </p>
              </div>
            </div>
          </template>
        </BaseCard>

        <BaseCard :title="t('config.title')" :subtitle="t('config.subtitle')">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BaseSelect
              v-model="info"
              name="info"
              :label="t('info.label')"
              :options="infoOptions"
            />
            <BaseSelect
              v-model="approach"
              name="approach"
              :label="t('approach.label')"
              :options="approachOptions"
            />
            <BaseInput
              v-model="arr"
              name="arr"
              :label="t('arr.label')"
              :placeholder="t('arr.placeholder')"
              :hint="t('arr.hint')"
            />
            <BaseInput
              v-model="dep"
              name="dep"
              :label="t('dep.label')"
              :placeholder="t('dep.placeholder')"
              :hint="t('dep.hint')"
            />
            <BaseInput
              v-model="tl"
              name="tl"
              :label="t('tl.label')"
              :placeholder="t('tl.placeholder')"
              :hint="t('tl.hint')"
            />
            <BaseInput
              v-model="remarks"
              name="remarks"
              :label="t('remarks.label')"
              :placeholder="t('remarks.placeholder')"
            />
          </div>
        </BaseCard>
      </div>

      <!-- Right: preview + EuroScope URL -->
      <div class="space-y-6">
        <BaseCard :title="t('preview.title')" :subtitle="t('preview.subtitle')">
          <template v-if="preview">
            <div class="mb-3 flex justify-end">
              <BaseButton
                size="sm"
                variant="secondary"
                @click="copy(preview, 'text')"
              >
                <template #icon>
                  <Icon
                    :name="copied === 'text' ? 'checkCircle' : 'documentText'"
                    class="size-4"
                  />
                </template>
                {{ copied === "text" ? t("copied") : t("copy") }}
              </BaseButton>
            </div>
            <pre
              class="overflow-x-auto whitespace-pre-line rounded-control bg-surface-sunken p-4 font-mono text-sm leading-relaxed text-ink"
              >{{ preview }}</pre>
          </template>
          <EmptyState
            v-else
            icon="speakerWave"
            compact
            :title="t('preview.empty')"
          />
        </BaseCard>

        <BaseCard :title="t('url.title')" :subtitle="t('url.subtitle')">
          <div class="mb-3 max-w-[12rem]">
            <BaseSelect
              v-model="slot"
              name="slot"
              :label="t('slot.label')"
              :options="slotOptions"
            />
            <p class="mt-1.5 text-xs text-muted">{{ t("slot.hint") }}</p>
          </div>
          <div class="rounded-control bg-surface-sunken p-3">
            <p class="break-all font-mono text-xs text-ink">{{ makerUrl }}</p>
          </div>
          <div class="mt-3 flex justify-end">
            <BaseButton size="sm" @click="copy(makerUrl, 'url')">
              <template #icon>
                <Icon
                  :name="copied === 'url' ? 'checkCircle' : 'documentText'"
                  class="size-4"
                />
              </template>
              {{ copied === "url" ? t("copied") : t("copy") }}
            </BaseButton>
          </div>

          <ol class="mt-4 space-y-2 text-sm text-muted">
            <li class="flex gap-2">
              <span class="font-semibold text-airwaysn">1.</span
              ><span>{{ t("url.step1") }}</span>
            </li>
            <li class="flex gap-2">
              <span class="font-semibold text-airwaysn">2.</span
              ><span>{{ t("url.step2") }}</span>
            </li>
            <li class="flex gap-2">
              <span class="font-semibold text-airwaysn">3.</span
              ><span>{{ t("url.step3") }}</span>
            </li>
          </ol>

          <div class="mt-4 flex items-start gap-2 text-sm text-muted">
            <Icon name="informationCircle" class="mt-0.5 size-4 shrink-0" />
            <p>{{ t("url.note") }}</p>
          </div>
        </BaseCard>
      </div>
    </div>
  </div>
</template>
