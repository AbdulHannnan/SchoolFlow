/**
 * Shared presentation for staff meetings (Module 8.3). Isomorphic (no
 * server-only imports) so the service and the page format a meeting's time the
 * same way. `scheduledAt` is stored and formatted in the server's local zone,
 * matching the `datetime-local` input it came from.
 */

/** A meeting's date and time, e.g. "9 Oct 2026, 14:30". */
export function formatMeetingWhen(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
