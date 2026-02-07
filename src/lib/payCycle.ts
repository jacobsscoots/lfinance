import { format, addMonths, subMonths, startOfMonth, isBefore, isSameDay, subDays } from "date-fns";
import { getPayday, PaydaySettings, AdjustmentRule } from "./payday";

export interface PayCycle {
  start: Date;
  end: Date;
}

const DEFAULT_PAYDAY_SETTINGS: PaydaySettings = {
  paydayDate: 20,
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
  
  // If the date is on or after this month's payday, the cycle started this month
  if (isSameDay(date, currentMonthPayday) || date >= currentMonthPayday) {
    const nextMonthPayday = getPayday(
      addMonths(date, 1).getFullYear(),
      addMonths(date, 1).getMonth(),
      settings
    );
    return {
      start: currentMonthPayday,
      end: subDays(nextMonthPayday, 1),
    };
  }
  
  // Otherwise, the cycle started last month
  const prevMonth = subMonths(date, 1);
  const prevMonthPayday = getPayday(prevMonth.getFullYear(), prevMonth.getMonth(), settings);
  
  return {
    start: prevMonthPayday,
    end: subDays(currentMonthPayday, 1),
  };
}

/**
 * Gets the next pay cycle after a given cycle.
 */
export function getNextPayCycle(
  currentCycle: PayCycle,
  settings: PaydaySettings = DEFAULT_PAYDAY_SETTINGS
): PayCycle {
  // Next cycle starts the day after current cycle ends
  const nextStart = addMonths(currentCycle.start, 1);
  const nextStartPayday = getPayday(nextStart.getFullYear(), nextStart.getMonth(), settings);
  
  const followingMonth = addMonths(nextStart, 1);
  const followingPayday = getPayday(followingMonth.getFullYear(), followingMonth.getMonth(), settings);
  
  return {
    start: nextStartPayday,
    end: subDays(followingPayday, 1),
  };
}

/**
 * Gets the previous pay cycle before a given cycle.
 */
export function getPrevPayCycle(
  currentCycle: PayCycle,
  settings: PaydaySettings = DEFAULT_PAYDAY_SETTINGS
): PayCycle {
  // Previous cycle ends the day before current cycle starts
  const prevStart = subMonths(currentCycle.start, 1);
  const prevStartPayday = getPayday(prevStart.getFullYear(), prevStart.getMonth(), settings);
  
  return {
    start: prevStartPayday,
    end: subDays(currentCycle.start, 1),
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
