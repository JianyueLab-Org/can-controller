/**
 * Division membership rules, shared by the API that enforces them and the UI
 * that explains them.
 *
 * Membership is **one-way**. A member picks a home division once; after that
 * neither the home division nor any visiting division can be changed or left
 * from the member side — transfers and removals go through an instructor.
 * Position permissions live on the division row and are only ever granted by
 * an instructor; nothing a member does here can set them.
 *
 * Browser-safe: no prisma import.
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
