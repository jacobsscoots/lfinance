import { format, addDays, isWithinInterval, eachDayOfInterval, isSameDay, getDay } from "date-fns";

// ============= Types =============

export interface ShoppingWeekRange {
  start: Date;   // Sunday
  end: Date;     // Following Monday (9 days later)
}

export interface BlackoutRange {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

// ============= Core Week Logic =============

/**
 * Get the shopping week range for a given anchor date.
 * A shopping week runs from Sunday to the following Monday (9 days, inclusive).
 * 
 * @param anchorDate Any date within the desired week
 * @returns { start: Sunday, end: following Monday }
 */
export function getShoppingWeekRange(anchorDate: Date): ShoppingWeekRange {
  const anchor = new Date(anchorDate);
  anchor.setHours(0, 0, 0, 0);
  
  // Get day of week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeek = getDay(anchor);
  
  let start: Date;
  
  if (dayOfWeek === 0) {
    // It's Sunday - this is the start of a new shopping week
    start = new Date(anchor);
  } else if (dayOfWeek === 1) {
    // It's Monday - could be day 2 OR day 9 of a shopping week
    // 
    // Shopping week is 9 days: Sun(day1) Mon(day2) Tue Wed Thu Fri Sat Sun(day8) Mon(day9)
    // 
    // If yesterday (Sunday) makes sense as a start, use that (we're on day 2)
    // Otherwise, go back 8 days to find the previous Sunday (we're on day 9)
    //
    // Decision rule: We prefer the MORE RECENT Sunday as the start.
    // - "Day 2 Monday": Yesterday is Sunday → start = yesterday
    // - "Day 9 Monday": Yesterday is Sunday, but that Sunday is day 8 of the PREVIOUS cycle
    //   that started 7 days before it.
    //
    // The key insight: a Monday is day 2 if the previous Sunday is a "fresh" week start,
    // or day 9 if that previous Sunday is day 8 of an earlier cycle.
    //
    // Since we have overlapping weeks by design (weeks share 2 days: Sun + Mon),
    // we need to pick ONE interpretation. The most intuitive for users:
    // Monday belongs to the week that started the PREVIOUS day (Sunday).
    // This means Monday is always "day 2" of the current week.
    //
    // FIX: Start from yesterday (Sunday), making this Monday day 2.
    start = addDays(anchor, -1);
  } else {
    // Tue-Sat: go back to the previous Sunday
    start = addDays(anchor, -dayOfWeek);
  }
  
  // End is 8 days after start (Sunday + 8 = Monday, total 9 days)
  const end = addDays(start, 8);
  
  return { start, end };
}

/**
 * Format the shopping week range for display.
 * @returns "Sun 8 Feb → Mon 16 Feb 2026"
 */
export function formatShoppingWeekRange(range: ShoppingWeekRange): string {
  const startStr = format(range.start, "EEE d MMM");
  const endStr = format(range.end, "EEE d MMM yyyy");
  return `${startStr} → ${endStr}`;
}

/**
 * Get all dates in the shopping week range.
 * @returns Array of 9 dates (Sun through Mon)
 */
export function getShoppingWeekDates(range: ShoppingWeekRange): Date[] {
  return eachDayOfInterval({ start: range.start, end: range.end });
}

/**
 * Get date strings (YYYY-MM-DD) for the shopping week.
 */
export function getShoppingWeekDateStrings(range: ShoppingWeekRange): string[] {
  return getShoppingWeekDates(range).map(d => format(d, "yyyy-MM-dd"));
}

// ============= Blackout / Holiday Logic =============

/**
 * Check if a specific date is within any blackout range.
 */
export function isDateBlackout(date: Date | string, blackoutRanges: BlackoutRange[]): boolean {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  checkDate.setHours(0, 0, 0, 0);
  
  for (const range of blackoutRanges) {
    const rangeStart = new Date(range.start_date);
    const rangeEnd = new Date(range.end_date);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    
    if (isWithinInterval(checkDate, { start: rangeStart, end: rangeEnd })) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get the blackout reason for a specific date, if any.
 */
export function getBlackoutReason(date: Date | string, blackoutRanges: BlackoutRange[]): string | null {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  checkDate.setHours(0, 0, 0, 0);
  
  for (const range of blackoutRanges) {
    const rangeStart = new Date(range.start_date);
    const rangeEnd = new Date(range.end_date);
    rangeStart.setHours(0, 0, 0, 0);
    rangeEnd.setHours(23, 59, 59, 999);
    
    if (isWithinInterval(checkDate, { start: rangeStart, end: rangeEnd })) {
      return range.reason;
    }
  }
  
  return null;
}

/**
 * Get list of active (non-blackout) dates within a range.
 */
export function getActiveDatesInRange(
  range: ShoppingWeekRange,
  blackoutRanges: BlackoutRange[]
): Date[] {
  const allDates = getShoppingWeekDates(range);
  return allDates.filter(date => !isDateBlackout(date, blackoutRanges));
}

/**
 * Get list of active date strings (YYYY-MM-DD) within a range.
 */
export function getActiveDateStringsInRange(
  range: ShoppingWeekRange,
  blackoutRanges: BlackoutRange[]
): string[] {
  return getActiveDatesInRange(range, blackoutRanges).map(d => format(d, "yyyy-MM-dd"));
}

/**
 * Check if a date is within a shopping week range.
 */
export function isDateInShoppingWeek(date: Date | string, range: ShoppingWeekRange): boolean {
  const checkDate = typeof date === "string" ? new Date(date) : date;
  checkDate.setHours(0, 0, 0, 0);
  
  const start = new Date(range.start);
  const end = new Date(range.end);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  
  return isWithinInterval(checkDate, { start, end });
}

// ============= Navigation Helpers =============

/**
 * Get the next shopping week range.
 */
export function getNextShoppingWeek(currentRange: ShoppingWeekRange): ShoppingWeekRange {
  // Next week starts 9 days after current start (the Tuesday after current Monday)
  // Actually, next Sunday is 7 days after current Sunday
  const nextStart = addDays(currentRange.start, 7);
  return getShoppingWeekRange(nextStart);
}

/**
 * Get the previous shopping week range.
 */
export function getPreviousShoppingWeek(currentRange: ShoppingWeekRange): ShoppingWeekRange {
  const prevStart = addDays(currentRange.start, -7);
  return getShoppingWeekRange(prevStart);
}

/**
 * Check if the current date is within the given shopping week range.
 */
export function isCurrentShoppingWeek(range: ShoppingWeekRange): boolean {
  return isDateInShoppingWeek(new Date(), range);
}
