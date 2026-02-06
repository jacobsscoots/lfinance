import { 
  getDay, 
  subDays, 
  setDate, 
  addMonths, 
  startOfMonth,
  isBefore,
  isAfter,
  isSameDay
} from "date-fns";

/**
 * Calculates the actual payday for a given month based on Monzo early-pay rules.
 * 
 * Official payday: 20th of each month
 * Monzo early-pay rule: If 20th falls on Saturday, Sunday, or Monday → paid on the preceding Friday.
 * Otherwise paid on the 20th.
 * 
 * @param year - The year
 * @param month - The month (0-indexed, where 0 = January)
 * @returns The actual payday date
 */
export function getPayday(year: number, month: number): Date {
  // Get the 20th of the specified month
  const officialPayday = new Date(year, month, 20);
  const dayOfWeek = getDay(officialPayday);
  
  // Sunday = 0, Monday = 1, ..., Saturday = 6
  switch (dayOfWeek) {
    case 0: // Sunday - pay on Friday (2 days before)
      return subDays(officialPayday, 2);
    case 1: // Monday - pay on Friday (3 days before)
      return subDays(officialPayday, 3);
    case 6: // Saturday - pay on Friday (1 day before)
      return subDays(officialPayday, 1);
    default: // Tuesday-Friday - pay on the 20th
      return officialPayday;
  }
}

/**
 * Gets all paydays within a date range
 * 
 * @param startDate - Start of the range
 * @param endDate - End of the range
 * @returns Array of payday dates
 */
export function getPaydaysInRange(startDate: Date, endDate: Date): Date[] {
  const paydays: Date[] = [];
  let currentDate = startOfMonth(startDate);
  
  while (isBefore(currentDate, endDate) || isSameDay(currentDate, endDate)) {
    const payday = getPayday(currentDate.getFullYear(), currentDate.getMonth());
    
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
 * @returns The next payday date
 */
export function getNextPayday(fromDate: Date = new Date()): Date {
  let currentMonth = startOfMonth(fromDate);
  
  // Check current month's payday first
  let payday = getPayday(currentMonth.getFullYear(), currentMonth.getMonth());
  
  if (isAfter(payday, fromDate) || isSameDay(payday, fromDate)) {
    return payday;
  }
  
  // If current month's payday has passed, get next month's
  currentMonth = addMonths(currentMonth, 1);
  return getPayday(currentMonth.getFullYear(), currentMonth.getMonth());
}

/**
 * Gets the previous payday from a given date
 * 
 * @param fromDate - The date to calculate from
 * @returns The previous payday date
 */
export function getPreviousPayday(fromDate: Date = new Date()): Date {
  let currentMonth = startOfMonth(fromDate);
  
  // Check current month's payday first
  let payday = getPayday(currentMonth.getFullYear(), currentMonth.getMonth());
  
  if (isBefore(payday, fromDate)) {
    return payday;
  }
  
  // If current month's payday hasn't happened yet, get previous month's
  currentMonth = addMonths(currentMonth, -1);
  return getPayday(currentMonth.getFullYear(), currentMonth.getMonth());
}

/**
 * Gets the current pay cycle (start and end dates)
 * 
 * @param fromDate - The reference date
 * @returns Object with start (previous payday) and end (next payday - 1 day) dates
 */
export function getCurrentPayCycle(fromDate: Date = new Date()): { start: Date; end: Date } {
  const previousPayday = getPreviousPayday(fromDate);
  const nextPayday = getNextPayday(fromDate);
  
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
 * @returns Number of days until next payday
 */
export function getDaysUntilPayday(fromDate: Date = new Date()): number {
  const nextPayday = getNextPayday(fromDate);
  const diffTime = nextPayday.getTime() - fromDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
