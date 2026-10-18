/**
 * 本站的分部规则。
 *
 * 归属是单向的。
 * 归属分部由 HomeDivisionSetup.vue 设置一次。
 * 访问分部由 VisitingDivisions.vue 只增不减。
 * 转分部和移除由教员处理。
 * 席位权限由教员授予。
 * can-api 在 POST /api/v1/pilot/divisions 上执行每一条规则。
 */

/** `division.region` values a member may join. 0 (Unknown) is not selectable. */
export const SELECTABLE_REGIONS = [1, 2, 3, 4] as const;

// 能不能加访问分部，由 GET 回的 `canAddVisiting` / `minVisitingRating` 决定 ——
// can-api 用 POST 强制执行的同一条规则算出来，这里不再自己存一份门槛。

export function isSelectableRegion(value: unknown): value is number {
  return (
    typeof value === "number" &&
    (SELECTABLE_REGIONS as readonly number[]).includes(value)
  );
}

export interface DivisionRow {
  region: number;
  home: boolean;
  status: boolean;
  del: boolean;
  gnd: boolean;
  twr: boolean;
  app: boolean;
  ctr: boolean;
  instructor: boolean;
  director: boolean;
}

/** `GET /api/v1/pilot/divisions` 的 `data`。 */
export interface DivisionState {
  rating: number;
  home: DivisionRow | null;
  visiting: DivisionRow[];
  canSetHome: boolean;
  canAddVisiting: boolean;
  minVisitingRating: number;
}

export type VisitingGate = "needsHome" | "locked" | "open" | "full";

export function joinableRegions(state: DivisionState): number[] {
  const taken = new Set(
    [state.home, ...state.visiting]
      .filter((d): d is DivisionRow => d !== null)
      .map((d) => d.region),
  );
  return SELECTABLE_REGIONS.filter((region) => !taken.has(region));
}

export function visitingGate(state: DivisionState): VisitingGate {
  if (!state.home) return "needsHome";
  if (!state.canAddVisiting) return "locked";
  return joinableRegions(state).length ? "open" : "full";
}

export function errorMessageKey(
  payload: unknown,
  known: (key: string) => boolean,
): string {
  const code =
    payload && typeof payload === "object"
      ? (payload as { error?: unknown }).error
      : undefined;
  if (typeof code === "string" && known(`errors.${code}`)) {
    return `errors.${code}`;
  }
  return "errors.generic";
}

const POSITIONS = [
  ["del", "DEL"],
  ["gnd", "GND"],
  ["twr", "TWR"],
  ["app", "APP"],
  ["ctr", "CTR"],
] as const;

export function positionsOf(row: DivisionRow) {
  return POSITIONS.filter(([key]) => row[key]).map(([key, label]) => ({
    key,
    label,
  }));
}
