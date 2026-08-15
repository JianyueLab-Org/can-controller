<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createTranslator } from "@/lib/i18n";
import AlertBox from "@/components/ui/AlertBox.vue";
import BaseBadge from "@/components/ui/BaseBadge.vue";
import BaseCard from "@/components/ui/BaseCard.vue";
import EmptyState from "@/components/ui/EmptyState.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import Skeleton from "@/components/ui/Skeleton.vue";
import StatCard from "@/components/ui/StatCard.vue";
import HomeDivisionSetup from "@/components/HomeDivisionSetup.vue";
import { apiFetch } from "@/lib/canApi";

// Scoped to the `controllers.dashboard` namespace — this island used to be
// handed the entire message dictionary just to read one branch of it.
const props = defineProps<{
  messages: Record<string, unknown>;
  /** `divisions` 命名空间，只传给第一次进来时的那道门。 */
  divisionMessages: Record<string, unknown>;
  /** `setup` 命名空间，同上。 */
  setupMessages: Record<string, unknown>;
  sessionUserId: string;
}>();
const t = createTranslator(props.messages);

interface DivisionData {
  id: number;
  region: number;
  del: boolean;
  gnd: boolean;
  app: boolean;
  twr: boolean;
  ctr: boolean;
  instructor: boolean;
  status: boolean;
  home: boolean;
  createdAt: string;
  updatedAt: string;
}
interface UserData {
  name: string;
  email: string;
  fsdpwd: string;
  homeDivision: DivisionData | null;
  division: DivisionData[];
  rating: { id: number; long: string; short: string; zh: string };
}
interface ATCStats {
  totalDurationMs: number;
  formattedTotalTime: string;
  totalRecords: number;
}

const userData = ref<UserData | null>(null);
const atcStats = ref<ATCStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

function getDivisionName(region: number) {
  const divisions: Record<number, string> = {
    0: t("unknownDivision"),
    1: t("chinaMainlandDivision"),
    2: t("usaDivision"),
    3: t("japanDivision"),
    4: t("hongkongDivision"),
  };
  return divisions[region] || t("unknownDivision");
}

/**
 * 拉这一页的两份数据。
 *
 * 抽成具名函数而不是留在 `onMounted` 里，是因为它现在有第二个调用方：设置完归属
 * 分部之后要重新读一次，才能把席位权限和分部信息显示出来。整页 reload 也能做到，
 * 但会话、外壳和侧栏都没有变，重新拉这一份就够了。
 */
async function load() {
  if (!props.sessionUserId) {
    loading.value = false;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    const userResponse = await apiFetch("/api/v1/pilot/data");
    if (!userResponse.ok) throw new Error("Failed to fetch user data");
    const userResult = await userResponse.json();
    userData.value = userResult.data;

    const atcResponse = await apiFetch(`/api/v1/pilot/${props.sessionUserId}`);
    if (atcResponse.ok) {
      const atcResult = await atcResponse.json();
      atcStats.value = atcResult.data.atc;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : "An error occurred";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function permsOf(div: DivisionData) {
  return [
    { key: "del", label: t("permissions.delivery"), value: div.del },
    { key: "gnd", label: t("permissions.ground"), value: div.gnd },
    { key: "twr", label: t("permissions.tower"), value: div.twr },
    { key: "app", label: t("permissions.approach"), value: div.app },
    { key: "ctr", label: t("permissions.center"), value: div.ctr },
    {
      key: "instructor",
      label: t("permissions.instructor"),
      value: div.instructor,
    },
  ];
}

const permissions = computed(() => {
  const hd = userData.value?.homeDivision;
  return hd ? permsOf(hd) : [];
});

function authLabel(v: boolean) {
  return v ? t("authorized") : t("unauthorized");
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString();
}
</script>

<template>
  <Skeleton v-if="loading" variant="stats" :count="6" header />

  <AlertBox v-else-if="error" variant="danger" :title="t('loadingFailed')">
    {{ error }}
  </AlertBox>

  <EmptyState v-else-if="!userData" icon="users" :title="t('noUserData')" />

  <!--
    还没有归属分部 —— 这一整页在那之前没有内容可显示：席位权限是空的、课程是空
    的、管制时长是 0。所以它是一道门，不是概览上的一行「未分配」。理由写在
    HomeDivisionSetup.vue 顶部。
  -->
  <HomeDivisionSetup
    v-else-if="!userData.homeDivision"
    :messages="divisionMessages"
    :setup-messages="setupMessages"
    @saved="load"
  />

  <div v-else>
    <PageHeader
      :title="`${t('welcome')}, ${userData.name}`"
      :description="t('subtitle')"
    >
      <template #actions>
        <BaseBadge variant="info">{{ userData.rating.short }}</BaseBadge>
      </template>
    </PageHeader>

    <div class="space-y-6">
      <!-- Stat cards -->
      <div class="stagger grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard
          :label="t('onlineTime')"
          :value="atcStats?.formattedTotalTime || '00:00:00'"
          :hint="`${atcStats?.totalRecords || 0}${t('sessionCount')}`"
          icon="clock"
          accent="info"
        />
        <StatCard
          :label="t('currentRating')"
          :value="userData.rating.short"
          :hint="userData.rating.zh"
          icon="academicCap"
          accent="success"
        />
        <StatCard
          :label="t('homeDivision')"
          :value="
            userData.homeDivision
              ? getDivisionName(userData.homeDivision.region)
              : t('unassigned')
          "
          :hint="userData.homeDivision?.status ? t('active') : t('inactive')"
          icon="shieldCheck"
          accent="neutral"
        />
      </div>

      <!-- Detail panels -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BaseCard :title="t('permissionDetails')" padding="none">
          <ul role="list" class="divide-y divide-subtle">
            <li
              v-for="perm in permissions"
              :key="perm.key"
              class="flex items-center justify-between gap-3 px-6 py-3"
            >
              <span class="text-sm font-medium text-ink">{{ perm.label }}</span>
              <BaseBadge
                :variant="perm.value ? 'success' : 'neutral'"
                size="sm"
              >
                {{ authLabel(perm.value) }}
              </BaseBadge>
            </li>
            <li v-if="!permissions.length" class="px-6">
              <EmptyState compact icon="shieldCheck" :title="t('unassigned')" />
            </li>
          </ul>
        </BaseCard>

        <BaseCard :title="t('futureCourses')" padding="none">
          <EmptyState
            icon="calendarDays"
            :title="t('noCourses')"
            :description="t('contactInstructor')"
          />
        </BaseCard>
      </div>

      <!-- Rating info -->
      <BaseCard :title="t('ratingInfo')" padding="none">
        <dl class="grid grid-cols-1 gap-4 p-6 md:grid-cols-3">
          <div class="rounded-control bg-surface-sunken p-4 text-center">
            <dt class="text-xs uppercase tracking-wider text-faint">
              {{ t("shortName") }}
            </dt>
            <dd class="mt-1 text-lg font-bold text-ink">
              {{ userData.rating.short }}
            </dd>
          </div>
          <div class="rounded-control bg-surface-sunken p-4 text-center">
            <dt class="text-xs uppercase tracking-wider text-faint">
              {{ t("chineseName") }}
            </dt>
            <dd class="mt-1 text-lg font-semibold text-ink">
              {{ userData.rating.zh }}
            </dd>
          </div>
          <div class="rounded-control bg-surface-sunken p-4 text-center">
            <dt class="text-xs uppercase tracking-wider text-faint">
              {{ t("fullName") }}
            </dt>
            <dd class="mt-1 text-lg font-medium text-ink">
              {{ userData.rating.long }}
            </dd>
          </div>
        </dl>
      </BaseCard>

      <!-- Division info -->
      <BaseCard
        v-if="userData.division && userData.division.length > 0"
        :title="t('divisionInfo')"
        padding="none"
      >
        <div class="divide-y divide-subtle">
          <div
            v-for="(div, index) in userData.division"
            :key="index"
            class="grid grid-cols-1 gap-6 p-6 md:grid-cols-2"
          >
            <div>
              <h3
                class="mb-3 text-xs font-semibold uppercase tracking-widest text-faint"
              >
                {{ t("basicInfo") }}
              </h3>
              <dl class="space-y-2.5 text-sm">
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-muted">{{ t("divisionName") }}</dt>
                  <dd class="font-medium text-ink">
                    {{ getDivisionName(div.region) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-muted">{{ t("status") }}</dt>
                  <dd>
                    <BaseBadge
                      :variant="div.status ? 'success' : 'neutral'"
                      size="sm"
                    >
                      {{ div.status ? t("active") : t("inactive") }}
                    </BaseBadge>
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-muted">{{ t("joinTime") }}</dt>
                  <dd class="tnum font-medium text-ink">
                    {{ formatDate(div.createdAt) }}
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3
                class="mb-3 text-xs font-semibold uppercase tracking-widest text-faint"
              >
                {{ t("permissions.name") }}
              </h3>
              <dl class="space-y-2.5 text-sm">
                <div
                  v-for="perm in permsOf(div)"
                  :key="perm.key"
                  class="flex items-center justify-between gap-3"
                >
                  <dt class="text-muted">{{ perm.label }}</dt>
                  <dd>
                    <BaseBadge
                      :variant="perm.value ? 'success' : 'neutral'"
                      size="sm"
                    >
                      {{ authLabel(perm.value) }}
                    </BaseBadge>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>
