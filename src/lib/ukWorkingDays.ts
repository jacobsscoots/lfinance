/**
 * UK Working Day calculations with bank holiday support
 * 
 * ASSUMPTIONS:
 * - Payday is 20th, moves to PREVIOUS working day if weekend/holiday
 * - Working day = Mon-Fri excluding UK bank holidays
 * - Monzo early-pay rule: If 20th is Mon/Sat/Sun → previous Friday
 */

import { format, subDays, getDay } from "date-fns";

// Hardcoded UK bank holidays 2024-2030 (fallback if DB unavailable)
const UK_BANK_HOLIDAYS_FALLBACK: string[] = [
  // 2024
  "2024-01-01", "2024-03-29", "2024-04-01", "2024-05-06", "2024-05-27",
  "2024-08-26", "2024-12-25", "2024-12-26",
  // 2025
  "2025-01-01", "2025-04-18", "2025-04-21", "2025-05-05", "2025-05-26",
  "2025-08-25", "2025-12-25", "2025-12-26",
  // 2026
  "2026-01-01", "2026-04-03", "2026-04-06", "2026-05-04", "2026-05-25",
  "2026-08-31", "2026-12-25", "2026-12-28",
  // 2027
  "2027-01-01", "2027-03-26", "2027-03-29", "2027-05-03", "2027-05-31",
  "2027-08-30", "2027-12-27", "2027-12-28",
  // 2028
  "2028-01-03", "2028-04-14", "2028-04-17", "2028-05-01", "2028-05-29",
  "2028-08-28", "2028-12-25", "2028-12-26",
  // 2029
  "2029-01-01", "2029-03-30", "2029-04-02", "2029-05-07", "2029-05-28",
  "2029-08-27", "2029-12-25", "2029-12-26",
  // 2030
  "2030-01-01", "2030-04-19", "2030-04-22", "2030-05-06", "2030-05-27",
  "2030-08-26", "2030-12-25", "2030-12-26",
];

let cachedHolidays: Set<string> | null = null;

/**
 * Set bank holidays from database (call on app init)
 */
export function setBankHolidays(dates: Date[]): void {
  cachedHolidays = new Set(dates.map(d => format(d, "yyyy-MM-dd")));
}

/**
 * Check if a date is a UK bank holiday
 */
export function isBankHoliday(date: Date): boolean {
  const dateStr = format(date, "yyyy-MM-dd");
  if (cachedHolidays) return cachedHolidays.has(dateStr);
  return UK_BANK_HOLIDAYS_FALLBACK.includes(dateStr);
}

/**
 * Check if a date falls on a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = getDay(date);
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Check if a date is a working day (Mon-Fri, not bank holiday)
 */
export function isWorkingDay(date: Date): boolean {
  return !isWeekend(date) && !isBankHoliday(date);
}

/**
 * Get the previous working day from a given date
 */
export function getPreviousWorkingDay(date: Date): Date {
  let current = subDays(date, 1);
  while (!isWorkingDay(current)) {
    current = subDays(current, 1);
  }
  return current;
}

/**
 * Get the actual payday for a given month.
 * UK rule: Payday is the 20th, but if 20th is weekend/holiday,
 * pay on the PREVIOUS working day.
 * 
 * Special case (Monzo early-pay rule): 
 * - If 20th is Monday → Friday 17th
 * - If 20th is Saturday → Friday 19th
 * - If 20th is Sunday → Friday 18th
 */
export function getPaydayForMonth(year: number, month: number): Date {
  const twentieth = new Date(year, month, 20);
  const dayOfWeek = getDay(twentieth);
  
  // Monzo early-pay rule: Mon/Sat/Sun → previous Friday
  if (dayOfWeek === 0) { // Sunday
    return subDays(twentieth, 2); // Friday 18th
  } else if (dayOfWeek === 1) { // Monday
    return subDays(twentieth, 3); // Friday 17th
  } else if (dayOfWeek === 6) { // Saturday
    return subDays(twentieth, 1); // Friday 19th
  }
  
  // For Tue-Fri, check if it's a bank holiday
  if (isBankHoliday(twentieth)) {
    return getPreviousWorkingDay(twentieth);
  }
  
  return twentieth;
}

/**
 * Get the pay cycle (start and end dates) for a given reference date
 */
export function getPayCycleForDate(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  const thisMonthPayday = getPaydayForMonth(year, month);
  
  if (date >= thisMonthPayday) {
    // We're past this month's payday, cycle is thisMonth → nextMonth
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    return {
      start: thisMonthPayday,
      end: subDays(getPaydayForMonth(nextYear, nextMonth), 1),
    };
  } else {
    // We're before this month's payday, cycle is lastMonth → thisMonth
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    return {
      start: getPaydayForMonth(prevYear, prevMonth),
      end: subDays(thisMonthPayday, 1),
    };
  }
}
