import { 
  getDay, 
  subDays, 
  addDays,
  addMonths, 
  startOfMonth,
  isBefore,
  isAfter,
  isSameDay
} from "date-fns";
import { 
  isWorkingDay, 
  getPreviousWorkingDay, 
  getNextWorkingDay, 
  getClosestWorkingDay 
} from "./ukWorkingDays";

export type AdjustmentRule = 
  | "previous_working_day" 
  | "next_working_day" 
  | "closest_working_day" 
  | "no_adjustment";

export interface PaydaySettings {
  paydayDate: number; // 1-28
  adjustmentRule: AdjustmentRule;
}

const DEFAULT_SETTINGS: PaydaySettings = {
  paydayDate: 19,
  adjustmentRule: "previous_working_day",
};

/**
 * Calculates the actual payday for a given month based on configurable rules.
 * 
 * @param year - The year
 * @param month - The month (0-indexed, where 0 = January)
 * @param settings - Optional payday configuration (defaults to 20th with previous working day)
 * @returns The actual payday date
 */
export function getPayday(
  year: number, 
  month: number, 
  settings: PaydaySettings = DEFAULT_SETTINGS
): Date {
  const { paydayDate, adjustmentRule } = settings;
  
  // Handle months shorter than the payday date (e.g., Feb 30th -> use last day)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const effectiveDay = Math.min(paydayDate, daysInMonth);
  
  const officialPayday = new Date(year, month, effectiveDay);
  
  // No adjustment - return the exact date
  if (adjustmentRule === "no_adjustment") {
    return officialPayday;
  }
  
  // If already a working day, no adjustment needed
  if (isWorkingDay(officialPayday)) {
    return officialPayday;
  }
  
  // Apply the adjustment rule
  switch (adjustmentRule) {
    case "previous_working_day":
      return getPreviousWorkingDay(officialPayday);
    case "next_working_day":
      return getNextWorkingDay(officialPayday);
    case "closest_working_day":
      return getClosestWorkingDay(officialPayday);
    default:
      return officialPayday;
  }
}

/**
 * Gets all paydays within a date range
 * 
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @param settings - Optional payday configuration
 * @returns Array of payday dates
 */
export function getPaydaysInRange(
  startDate: Date, 
  endDate: Date, 
  settings: PaydaySettings = DEFAULT_SETTINGS
): Date[] {
  const paydays: Date[] = [];
  let currentDate = startOfMonth(startDate);
  
  while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
    const payday = getPayday(currentDate.getFullYear(), currentDate.getMonth(), settings);
    
    if (
      (isAfter(payday, startDate) || isSameDay(payday, startDate)) &&
      (isBefore(payday, endDate) || isSameDay(payday, endDate))
    ) {
      paydays.push(payday);
    }
    
    currentDate = addMonths(currentDate, 1);
  }
  
  return paydays;
}

/**
 * Gets the next payday from a given date
 * 
 * @param fromDate - The date to calculate from
 * @param settings - Optional payday configuration
 * @returns The next payday date
 */
export function getNextPayday(
  fromDate: Date = new Date(), 
  settings: PaydaySettings = DEFAULT_SETTINGS
): Date {
  let currentMonth = startOfMonth(fromDate);
  
  // Check current month's payday first
  let payday = getPayday(currentMonth.getFullYear(), currentMonth.getMonth(), settings);
  
  if (isAfter(payday, fromDate) || isSameDay(payday, fromDate)) {
    return payday;
  }
  
  // If current month's payday has passed, get next month's
  currentMonth = addMonths(currentMonth, 1);
  return getPayday(currentMonth.getFullYear(), currentMonth.getMonth(), settings);
}

/**
 * Gets the previous payday from a given date
 * 
 * @param fromDate - The date to calculate from
 * @param settings - Optional payday configuration
 * @returns The previous payday date
 */
export function getPreviousPayday(
  fromDate: Date = new Date(), 
  settings: PaydaySettings = DEFAULT_SETTINGS
): Date {
  let currentMonth = startOfMonth(fromDate);
  
  // Check current month's payday first
  let payday = getPayday(currentMonth.getFullYear(), currentMonth.getMonth(), settings);
  
  if (isBefore(payday, fromDate)) {
    return payday;
  }
  
  // If current month's payday hasn't happened yet, get previous month's
  currentMonth = addMonths(currentMonth, -1);
  return getPayday(currentMonth.getFullYear(), currentMonth.getMonth(), settings);
}

/**
 * Gets the current pay cycle (start and end dates)
 * 
 * @param fromDate - The reference date
 * @param settings - Optional payday configuration
 * @returns Object with start (previous payday) and end (next payday - 1 day) dates
 */
export function getCurrentPayCycle(
  fromDate: Date = new Date(), 
  settings: PaydaySettings = DEFAULT_SETTINGS
): { start: Date; end: Date } {
  const previousPayday = getPreviousPayday(fromDate, settings);
  const nextPayday = getNextPayday(fromDate, settings);
  
  // Pay cycle ends the day before the next payday
  return {
    start: previousPayday,
    end: subDays(nextPayday, 1),
  };
}

/**
 * Calculates days until next payday
 * 
 * @param fromDate - The date to calculate from
 * @param settings - Optional payday configuration
 * @returns Number of days until next payday
 */
export function getDaysUntilPayday(
  fromDate: Date = new Date(), 
  settings: PaydaySettings = DEFAULT_SETTINGS
): number {
  const nextPayday = getNextPayday(fromDate, settings);
  const diffTime = nextPayday.getTime() - fromDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
