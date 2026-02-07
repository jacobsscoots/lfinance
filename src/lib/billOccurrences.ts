/**
 * Bill occurrence calculation
 * 
 * ASSUMPTIONS:
 * - Occurrences are computed on-the-fly, not pre-stored for all future months
 * - Due dates stay on exact date (no auto-shift for weekends/holidays)
 */

import { 
  addWeeks, 
  addMonths, 
  startOfMonth, 
  endOfMonth, 
  isBefore, 
  isAfter, 
  isSameDay, 
  format, 
  parseISO, 
  lastDayOfMonth,
  eachWeekOfInterval,
  setDay,
} from "date-fns";
import type { Bill } from "@/hooks/useBills";

export interface BillOccurrence {
  id: string;
  billId: string;
  billName: string;
  dueDate: Date;
  expectedAmount: number;
  status: "due" | "paid" | "overdue" | "skipped";
  paidTransactionId?: string;
  paidAt?: Date;
  matchConfidence?: "high" | "medium" | "manual";
  bill: Bill;
}

/**
 * Get the due date for a bill in a specific month
 */
function getDueDateForMonth(bill: Bill, year: number, month: number): Date {
  const dueDay = bill.due_day;
  const lastDay = lastDayOfMonth(new Date(year, month, 1)).getDate();
  
  // Handle days that don't exist in shorter months (e.g., 31 in February)
  const actualDay = Math.min(dueDay, lastDay);
  
  return new Date(year, month, actualDay);
}

/**
 * Get the next occurrence after a given date based on frequency
 */
function getNextOccurrence(bill: Bill, currentDate: Date): Date {
  switch (bill.frequency) {
    case "weekly":
      return addWeeks(currentDate, 1);
    case "fortnightly":
      return addWeeks(currentDate, 2);
    case "monthly":
      // For monthly, move to the same day next month
      const nextMonth = addMonths(currentDate, 1);
      return getDueDateForMonth(bill, nextMonth.getFullYear(), nextMonth.getMonth());
    case "quarterly":
      const quarterMonth = addMonths(currentDate, 3);
      return getDueDateForMonth(bill, quarterMonth.getFullYear(), quarterMonth.getMonth());
    case "yearly":
      const yearMonth = addMonths(currentDate, 12);
      return getDueDateForMonth(bill, yearMonth.getFullYear(), yearMonth.getMonth());
    default:
      return addMonths(currentDate, 1);
  }
}

/**
 * Generate all occurrences of a bill within a date range
 */
export function generateBillOccurrences(
  bill: Bill,
  rangeStart: Date,
  rangeEnd: Date
): BillOccurrence[] {
  if (!bill.is_active) return [];
  
  const occurrences: BillOccurrence[] = [];
  const billStart = bill.start_date ? parseISO(bill.start_date) : new Date(2020, 0, 1);
  const billEnd = bill.end_date ? parseISO(bill.end_date) : null;
  
  // For weekly/fortnightly, use a different approach
  if (bill.frequency === "weekly" || bill.frequency === "fortnightly") {
    // Start from the bill start date or range start, whichever is later
    let currentDate = billStart;
    
    // If bill started before range, advance to first occurrence in range
    while (isBefore(currentDate, rangeStart)) {
      currentDate = getNextOccurrence(bill, currentDate);
    }
    
    // Generate occurrences within range
    while (isBefore(currentDate, rangeEnd) || isSameDay(currentDate, rangeEnd)) {
      if (billEnd && isAfter(currentDate, billEnd)) break;
      
      occurrences.push({
        id: `${bill.id}-${format(currentDate, "yyyy-MM-dd")}`,
        billId: bill.id,
        billName: bill.name,
        dueDate: currentDate,
        expectedAmount: Number(bill.amount),
        status: "due",
        bill,
      });
      
      currentDate = getNextOccurrence(bill, currentDate);
    }
    
    return occurrences;
  }
  
  // For monthly/quarterly/yearly, calculate by month
  let currentDate = getDueDateForMonth(bill, rangeStart.getFullYear(), rangeStart.getMonth());
  
  // If this month's occurrence is before range start, move to next
  if (isBefore(currentDate, rangeStart)) {
    currentDate = getNextOccurrence(bill, currentDate);
  }
  
  while (isBefore(currentDate, rangeEnd) || isSameDay(currentDate, rangeEnd)) {
    // Check if within bill's active period
    if (billEnd && isAfter(currentDate, billEnd)) break;
    if (isBefore(currentDate, billStart)) {
      currentDate = getNextOccurrence(bill, currentDate);
      continue;
    }
    
    occurrences.push({
      id: `${bill.id}-${format(currentDate, "yyyy-MM-dd")}`,
      billId: bill.id,
      billName: bill.name,
      dueDate: currentDate,
      expectedAmount: Number(bill.amount),
      status: "due",
      bill,
    });
    
    currentDate = getNextOccurrence(bill, currentDate);
  }
  
  return occurrences;
}

/**
 * Get all bill occurrences for a specific month
 */
export function getBillOccurrencesForMonth(
  bills: Bill[],
  year: number,
  month: number
): BillOccurrence[] {
  const rangeStart = startOfMonth(new Date(year, month, 1));
  const rangeEnd = endOfMonth(new Date(year, month, 1));
  
  return bills.flatMap(bill => generateBillOccurrences(bill, rangeStart, rangeEnd));
}

/**
 * Get all bill occurrences within a date range
 */
export function getBillOccurrencesInRange(
  bills: Bill[],
  rangeStart: Date,
  rangeEnd: Date
): BillOccurrence[] {
  return bills.flatMap(bill => generateBillOccurrences(bill, rangeStart, rangeEnd));
}
