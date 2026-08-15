<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createTranslator } from "@/lib/i18n";
import { formatZulu, formatLocal } from "@/lib/activities";
import {
  MAX_RESERVATION_DESCRIPTION,
  MAX_RESERVATION_HOURS,
  MAX_RESERVATION_LEAD_DAYS,
  reservationWindowError,
} from "@/lib/atcReservations";
import AlertBox from "@/components/ui/AlertBox.vue";
import BaseButton from "@/components/ui/BaseButton.vue";
import BaseCard from "@/components/ui/BaseCard.vue";
import BaseDialog from "@/components/ui/BaseDialog.vue";
import BaseInput from "@/components/ui/BaseInput.vue";
import DataTable from "@/components/ui/DataTable.vue";
import Icon from "@/components/ui/Icon.vue";
import PageHeader from "@/components/ui/PageHeader.vue";
import { apiFetch, unwrapList } from "@/lib/canApi";

const props = defineProps<{
  messages: Record<string, unknown>;
  sessionUserId: string;
  isSup: boolean;
}>();
const t = createTranslator(props.messages);

interface Reservation {
  id: number;
  username: string;
  callsign: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
}

const reservations = ref<Reservation[]>([]);
const loading = ref(true);
const feedback = ref<{ type: "success" | "error"; text: string } | null>(null);
const dialogError = ref<string | null>(null);

const createOpen = ref(false);
const creating = ref(false);
const createForm = ref<HTMLFormElement | null>(null);
const form = ref({ callsign: "", description: "", startsAt: "", endsAt: "" });

// Cancel confirmation. Removing a slot from the board is destructive, and a
// SUP/ADM does it to *someone else's* row — so it is confirmed against the
// callsign rather than fired by one click on a ghost button. `window.confirm`
// would block the tab and read in the browser's language, not the member's.
const cancelTarget = ref<Reservation | null>(null);
const cancelling = ref(false);

/** A member acts only on their own row; a SUP/ADM can cancel anyone's. */
const canManage = (row: Reservation) =>
  props.isSup || row.username === props.sessionUserId;

const columns = [
  { key: "callsign", label: t("callsign") },
  { key: "username", label: t("controller") },
  { key: "window", label: t("window") },
  { key: "notes", label: t("notes") },
  { key: "actions", label: "", align: "right" as const },
];

/**
 * The bounds are quoted from the shared rules rather than written into the
 * dictionaries, so the sentence cannot drift from what the API enforces.
 */
const ruleLimits = {
  hours: MAX_RESERVATION_HOURS,
  days: MAX_RESERVATION_LEAD_DAYS,
  chars: MAX_RESERVATION_DESCRIPTION,
};

/**
 * Server error code → message key. Every failure used to land on "you already
 * have an active reservation", which is the one sentence guaranteed to send
 * someone looking for a reservation that does not exist.
 */
const CREATE_ERRORS: Record<string, string> = {
  alreadyReserved: "errorAlreadyReserved",
  invalidCallsign: "errorCallsign",
  descriptionTooLong: "errorDescriptionTooLong",
  invalidTime: "errorWindow",
  endBeforeStart: "errorWindow",
  windowEnded: "errorWindow",
  windowTooLong: "errorWindow",
  startTooEarly: "errorWindow",
  startTooFar: "errorWindow",
};

/** datetime-local values are local browser time; restate them as Zulu. */
function toIso(value: string): string {
  return new Date(value).toISOString();
}
function formatDate(iso: string): string {
  return t("timeWithLocal", { zulu: formatZulu(iso), local: formatLocal(iso) });
}

/**
 * The same rules the API applies, so the form answers before a round-trip.
 * The server still decides — its clock is the one that counts.
 */
const windowError = computed(() => {
  if (!form.value.startsAt || !form.value.endsAt) return null;
  return reservationWindowError(
    form.value.startsAt,
    form.value.endsAt,
    Date.now(),
  );
});
const endsAtError = computed(() =>
  windowError.value === "endBeforeStart" ? t("endBeforeStart") : undefined,
);

async function load(silent = false) {
  if (!silent) loading.value = true;
  try {
    const res = await apiFetch("/api/v1/atc/reservations");
    if (!res.ok) throw new Error();
    const payload = await res.json();
    // can-api envelopes every list under a named key — `data` is
    // `{reservations: [...]}`, not the bare array the pre-migration route
    // returned. Reading `data` directly left `rows` holding an object, which
    // DataTable renders as no rows at all: an empty board with no error.
    reservations.value = unwrapList<Reservation>(payload.data, "reservations");
    // A stale error must not outlive the load that succeeded.
    if (feedback.value?.type === "error") feedback.value = null;
  } catch {
    reservations.value = [];
    feedback.value = { type: "error", text: t("loadFailed") };
  } finally {
    loading.value = false;
  }
}

async function create() {
  if (
    creating.value ||
    !form.value.callsign ||
    !form.value.startsAt ||
    !form.value.endsAt
  ) {
    return;
  }
  if (windowError.value) {
    dialogError.value =
      windowError.value === "endBeforeStart"
        ? t("endBeforeStart")
        : t("errorWindow", ruleLimits);
    return;
  }
  creating.value = true;
  dialogError.value = null;
  try {
    const res = await apiFetch("/api/v1/atc/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callsign: form.value.callsign.trim(),
        description: form.value.description.trim() || undefined,
        startsAt: toIso(form.value.startsAt),
        endsAt: toIso(form.value.endsAt),
      }),
    });
    if (!res.ok) {
      // 429 carries no `error` code of its own; anything unrecognised is a
      // generic failure rather than a guess at which rule was broken.
      let code = "";
      if (res.status === 429) {
        code = "errorTooMany";
      } else {
        const payload = await res.json().catch(() => null);
        code = CREATE_ERRORS[String(payload?.error ?? "")] ?? "";
      }
      dialogError.value = code ? t(code, ruleLimits) : t("errorGeneric");
      return;
    }
    createOpen.value = false;
    form.value = { callsign: "", description: "", startsAt: "", endsAt: "" };
    feedback.value = { type: "success", text: t("createSuccess") };
    await load();
  } catch {
    dialogError.value = t("errorGeneric");
  } finally {
    creating.value = false;
  }
}

function askCancel(row: Reservation) {
  dialogError.value = null;
  cancelTarget.value = row;
}

async function confirmCancel() {
  // Guarded rather than left to a double click: the second DELETE matches
  // nothing and would report a failure for an action that had succeeded.
  if (cancelling.value || !cancelTarget.value) return;
  cancelling.value = true;
  try {
    const res = await apiFetch(
      `/api/v1/atc/reservations/${cancelTarget.value.id}`,
      { method: "DELETE" },
    );
    if (!res.ok) throw new Error();
    cancelTarget.value = null;
    feedback.value = { type: "success", text: t("cancelSuccess") };
    await load(true);
  } catch {
    dialogError.value = t("cancelFailed");
  } finally {
    cancelling.value = false;
  }
}

function openCreate() {
  dialogError.value = null;
  createOpen.value = true;
}

onMounted(load);
</script>

<template>
  <div>
    <PageHeader
      :title="t('title')"
      :description="t('description')"
      icon="calendarDays"
    >
      <template #actions>
        <BaseButton @click="openCreate">
          <template #icon><Icon name="plus" class="size-4" /></template>
          {{ t("create") }}
        </BaseButton>
      </template>
    </PageHeader>

    <AlertBox
      v-if="feedback"
      class="mb-6"
      :variant="feedback.type === 'success' ? 'success' : 'danger'"
      dismissible
      @dismiss="feedback = null"
    >
      {{ feedback.text }}
    </AlertBox>

    <BaseCard padding="none">
      <div class="p-6">
        <DataTable
          :columns="columns"
          :rows="reservations"
          row-key="id"
          :loading="loading"
          :loading-label="t('loading')"
          :empty="t('noReservations')"
        >
          <template #cell-callsign="{ row }">
            <span class="font-mono">{{ row.callsign }}</span>
          </template>
          <template #cell-window="{ row }">
            <div class="whitespace-normal">
              {{ formatDate(row.startsAt) }}
              <span class="block text-xs text-faint">{{
                t("untilTime", { time: formatDate(row.endsAt) })
              }}</span>
            </div>
          </template>
          <template #cell-notes="{ row }">
            <span class="text-muted">{{ row.description || "—" }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="flex justify-end gap-2">
              <BaseButton
                v-if="canManage(row)"
                size="sm"
                variant="ghost"
                @click="askCancel(row)"
              >
                {{ t("cancel") }}
              </BaseButton>
              <span v-else class="text-xs text-faint">—</span>
            </div>
          </template>
        </DataTable>
      </div>
    </BaseCard>

    <BaseDialog
      v-model:open="createOpen"
      :title="t('create')"
      :description="t('createHint')"
      :close-label="t('close')"
    >
      <form ref="createForm" class="space-y-4" @submit.prevent="create">
        <AlertBox v-if="dialogError" variant="danger">{{
          dialogError
        }}</AlertBox>
        <BaseInput
          v-model="form.callsign"
          name="reservation-callsign"
          :label="t('formCallsign')"
          :hint="t('formCallsignHint')"
          :maxlength="16"
          required
        />
        <BaseInput
          v-model="form.description"
          name="reservation-description"
          :label="t('formDescription')"
          :maxlength="MAX_RESERVATION_DESCRIPTION"
        />
        <BaseInput
          v-model="form.startsAt"
          type="datetime-local"
          name="reservation-starts"
          :label="t('formStartsAt')"
          required
        />
        <BaseInput
          v-model="form.endsAt"
          type="datetime-local"
          name="reservation-ends"
          :label="t('formEndsAt')"
          :hint="t('formEndsAtHint', ruleLimits)"
          :error="endsAtError"
          required
        />
      </form>
      <template #footer>
        <BaseButton variant="secondary" @click="createOpen = false">{{
          t("close")
        }}</BaseButton>
        <BaseButton :loading="creating" @click="createForm?.requestSubmit()">
          <template #icon><Icon name="plus" class="size-4" /></template>
          {{ t("submit") }}
        </BaseButton>
      </template>
    </BaseDialog>

    <!-- Cancelling takes a slot off the public board — and a SUP/ADM does it to
         another member's row — so it is confirmed against the callsign. -->
    <BaseDialog
      :open="!!cancelTarget"
      size="sm"
      :title="t('cancelTitle')"
      :close-label="t('close')"
      @close="cancelTarget = null"
    >
      <AlertBox v-if="dialogError" variant="danger" class="mb-4">{{
        dialogError
      }}</AlertBox>
      <p class="text-sm text-muted">{{ t("cancelConfirm") }}</p>
      <p
        class="mt-3 rounded-control bg-surface-sunken px-3 py-2.5 text-sm font-medium text-ink"
      >
        <span class="font-mono">{{ cancelTarget?.callsign }}</span>
        <span class="ml-2 text-muted">{{ cancelTarget?.username }}</span>
      </p>
      <template #footer>
        <BaseButton variant="secondary" @click="cancelTarget = null">
          {{ t("cancelKeep") }}
        </BaseButton>
        <BaseButton
          variant="danger"
          :loading="cancelling"
          @click="confirmCancel"
        >
          {{ t("cancelConfirmAction") }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>
