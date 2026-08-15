/**
 * ATC staffing reservations: what a valid window is, and how long a slot may
 * be held.
 *
 * Browser-safe and shared, so the form refuses the window the API would refuse
 * anyway and both sides quote the same numbers — the pattern `@/lib/support`
 * and `@/lib/activities` already follow. Error values are i18n key suffixes,
 * so nothing here formats a message.
 *
 * The bounds exist because a reservation is a *session announcement*, not a
 * standing claim on a station: a member holds at most one active reservation,
 * so an unbounded window is a member who has quietly locked themselves out of
 * the board until they remember to cancel. Expiry is the other half of that —
 * a reservation whose `endsAt` has passed is no longer active anywhere it is
 * read (see `/api/v1/atc/reservations`), so nothing needs a sweep job.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Longest single window. A staffing slot is a session, not a shift rota. */
export const MAX_RESERVATION_HOURS = 12;

/** How far ahead a slot may be announced. */
export const MAX_RESERVATION_LEAD_DAYS = 30;

/**
 * Grace for the "I am going online now" case: the browser fills the form from
 * its own clock, and a start a few minutes behind the server's is that, not a
 * reservation for the past.
 */
export const START_GRACE_MINUTES = 60;

/** Free-text note. The column is TEXT; this is what the form and API accept. */
export const MAX_RESERVATION_DESCRIPTION = 500;

export type ReservationWindowError =
  | "invalidTime"
  | "endBeforeStart"
  | "windowEnded"
  | "windowTooLong"
  | "startTooEarly"
  | "startTooFar";

/**
 * Validate a reservation window, or `null` if it is fine. `now` is passed in
 * rather than read here so the caller decides whose clock arbitrates — the
 * server's, always, for the write that matters.
 */
export function reservationWindowError(
  startsAt: Date | string | number,
  endsAt: Date | string | number,
  now: number,
): ReservationWindowError | null {
  const start = new Date(startsAt).getTime();
  const end = new Date(endsAt).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) return "invalidTime";
  if (end <= start) return "endBeforeStart";
  if (end <= now) return "windowEnded";
  if (end - start > MAX_RESERVATION_HOURS * HOUR) return "windowTooLong";
  if (start < now - START_GRACE_MINUTES * MINUTE) return "startTooEarly";
  if (start > now + MAX_RESERVATION_LEAD_DAYS * DAY) return "startTooFar";

  return null;
}
