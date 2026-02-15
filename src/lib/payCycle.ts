import { format, addMonths, subMonths, startOfMonth, isBefore, isSameDay } from "date-fns";
import { getPayday, PaydaySettings, AdjustmentRule } from "./payday";

export interface PayCycle {
  start: Date;
  end: Date;
}

const DEFAULT_PAYDAY_SETTINGS: PaydaySettings = {
  paydayDate: 19,
  adjustmentRule: "previous_working_day",
};

/**
 * Gets the pay cycle that contains a given date.
 * A pay cycle runs from payday to the day before the next payday.
 */
export function getPayCycleForDate(
  date: Date,
  settings: PaydaySettings = DEFAULT_PAYDAY_SETTINGS
): PayCycle {
  // Get the payday for the current month
  const currentMonthPayday = getPayday(date.getFullYear(), date.getMonth(), settings);
  
  // Payday is the LAST day of the old cycle, so only start a new cycle
  // the day AFTER payday (strictly after, not same day)
  if (!isSameDay(date, currentMonthPayday) && date > currentMonthPayday) {
    const nextMonth = addMonths(date, 1);
    const nextMonthPayday = getPayday(nextMonth.getFullYear(), nextMonth.getMonth(), settings);
    return {
      start: currentMonthPayday,
      end: nextMonthPayday,
    };
  }
  
  // On payday or before it: cycle started last month, ends on this month's payday
  const prevMonth = subMonths(date, 1);
  const prevMonthPayday = getPayday(prevMonth.getFullYear(), prevMonth.getMonth(), settings);
  
  return {
    start: prevMonthPayday,
    end: currentMonthPayday,
  };
}

/**
 * Gets the next pay cycle after a given cycle.
 */
export function getNextPayCycle(
  currentCycle: PayCycle,
  settings: PaydaySettings = DEFAULT_PAYDAY_SETTINGS
): PayCycle {
  // Next cycle starts on the current cycle's end date (payday)
  const nextStartPayday = currentCycle.end;
  
  const followingMonth = addMonths(nextStartPayday, 1);
  const followingPayday = getPayday(followingMonth.getFullYear(), followingMonth.getMonth(), settings);
  
  return {
    start: nextStartPayday,
    end: followingPayday,
  };
}

/**
 * Gets the previous pay cycle before a given cycle.
 */
export function getPrevPayCycle(
  currentCycle: PayCycle,
  settings: PaydaySettings = DEFAULT_PAYDAY_SETTINGS
): PayCycle {
  // Previous cycle ends on current cycle's start (payday)
  const prevStart = subMonths(currentCycle.start, 1);
  const prevStartPayday = getPayday(prevStart.getFullYear(), prevStart.getMonth(), settings);
  
  return {
    start: prevStartPayday,
    end: currentCycle.start,
  };
}

/**
 * Formats a pay cycle as a readable label.
 * Example: "17 Feb 2026 → 16 Mar 2026"
 */
export function formatPayCycleLabel(cycle: PayCycle): string {
  const startStr = format(cycle.start, "d MMM");
  const endStr = format(cycle.end, "d MMM yyyy");
  return `${startStr} → ${endStr}`;
}

/**
 * Formats a shorter pay cycle label for mobile.
 * Example: "17 Feb – 16 Mar"
 */
export function formatPayCycleLabelShort(cycle: PayCycle): string {
  const startStr = format(cycle.start, "d MMM");
  const endStr = format(cycle.end, "d MMM");
  return `${startStr} – ${endStr}`;
}

/**
 * Converts PaydaySettingsInput (from hook) to PaydaySettings (for lib functions)
 */
export function toPaydaySettings(input: {
  payday_date: number;
  adjustment_rule: AdjustmentRule;
}): PaydaySettings {
  return {
    paydayDate: input.payday_date,
    adjustmentRule: input.adjustment_rule,
  };
}
