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

/**
 * Minimum `user.rating` for adding visiting divisions — S3 (see `ratingTrans`
 * in src/lib/tools.ts). The UI reads the threshold back from the API and
 * labels itself from it, so this constant is the only place to change it.
 * The gate is enforced server-side in /api/v1/pilot/divisions.
 */
export const MIN_VISITING_RATING = 4;

export function isSelectableRegion(value: unknown): value is number {
  return (
    typeof value === "number" &&
    (SELECTABLE_REGIONS as readonly number[]).includes(value)
  );
}

export function canAddVisiting(rating: number | undefined): boolean {
  return typeof rating === "number" && rating >= MIN_VISITING_RATING;
}
