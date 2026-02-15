import { startOfWeek, addWeeks, getDay } from "date-fns";

/**
 * Returns the default week-start (Monday) based on smart logic:
 * - Mon–Sat → current week
 * - Sunday  → following week (user has finished shopping, wants to plan ahead)
 *
 * Uses local device time so timezone is handled correctly.
 */
export function getSmartWeekStart(now: Date = new Date()): Date {
  const day = getDay(now); // 0 = Sunday
  const base = startOfWeek(now, { weekStartsOn: 1 });
  return day === 0 ? addWeeks(base, 1) : base;
}
