import { differenceInDays, format, isBefore, isAfter, isSameDay, addDays } from "date-fns";
import type { PayCycle } from "./payCycle";

// ==================== Types ====================

export interface DailySpending {
  date: string;
  actual: number;
  expected: number;
  cumulative: number;
  expectedCumulative: number;
}

export interface BalanceProjection {
  best: number;
  expected: number;
  worst: number;
}

export interface Alert {
  id: string;
  type: "danger" | "warning" | "info" | "success";
  title: string;
  message: string;
  action?: {
    label: string;
    description: string;
  };
}

export interface PayCycleMetrics {
  // Cycle info
  cycleStart: Date;
  cycleEnd: Date;
  daysTotal: number;
  daysRemaining: number;
  daysPassed: number;
  
  // Balances
  startBalance: number;
  currentBalance: number;
  projectedEndBalance: BalanceProjection;
  
  // Runway "restart from today"
  anchorBalance: number;      // start-of-day balance (current + today's spend)
  spentToday: number;         // posted spend today
  remainingBalance: number;   // current non-credit balance
  
  // Budget buffer tracking
  dailyBudget: number;        // configured daily budget (e.g. £15)
  planRemaining: number;      // daily_budget * days_remaining (incl today)
  bufferStart: number;        // anchor_balance - plan_remaining (start of day)
  bufferTomorrow: number;     // current_balance - (daily_budget * (days_remaining - 1))
  
  // Spending
  totalSpent: number;
  totalIncome: number;
  expectedSpentByNow: number;
  safeToSpendPerDay: number;
  
  // Committed vs discretionary
  committedRemaining: number;
  discretionaryRemaining: number;
  bufferAmount: number;
  
  // Flags
  isOverPace: boolean;
  runwayRisk: boolean;
  hasData: boolean;
  
  // Chart data
  dailySpending: DailySpending[];
}

// ==================== Pure Calculation Functions ====================

/**
 * Calculate safe-to-spend per day
 */
export function calculateSafeToSpend(
  currentBalance: number,
  committedRemaining: number,
  daysRemaining: number
): number {
  if (daysRemaining <= 0) return 0;
  const discretionary = currentBalance - committedRemaining;
  return Math.max(0, discretionary / daysRemaining);
}

/**
 * Calculate projected end-of-cycle balance
 */
export function calculateProjectedEndBalance(
  currentBalance: number,
  spentSoFar: number,
  daysPassed: number,
  daysRemaining: number,
  committedRemaining: number
): BalanceProjection {
  // Best case: no more discretionary spending, only committed
  const best = currentBalance - committedRemaining;
  
  // Expected: continue at current pace + committed
  const dailyPace = daysPassed > 0 ? spentSoFar / daysPassed : 0;
  const projectedAdditionalSpend = dailyPace * daysRemaining;
  const expected = currentBalance - committedRemaining - projectedAdditionalSpend;
  
  // Worst case: 1.5x current pace (overspending buffer)
  const worstAdditionalSpend = projectedAdditionalSpend * 1.5;
  const worst = currentBalance - committedRemaining - worstAdditionalSpend;
  
  return {
    best: Math.max(0, best),
    expected: Math.round(expected * 100) / 100,
    worst: Math.round(worst * 100) / 100,
  };
}

/**
 * Calculate net position (income - expenses)
 */
export function calculateNetPosition(income: number, expenses: number): number {
  return income - expenses;
}

/**
 * Check if there's runway risk (low discretionary relative to days)
 */
export function checkRunwayRisk(
  discretionaryRemaining: number,
  daysRemaining: number,
  threshold: number = 10 // £ per day minimum
): boolean {
  if (daysRemaining <= 0) return false;
  return discretionaryRemaining / daysRemaining < threshold;
}

/**
 * Build daily spending data for charts
 */
export function buildDailySpendingData(
  cycle: PayCycle,
  transactions: Array<{ transaction_date: string; amount: number; type: string }>,
  totalBudget: number
): DailySpending[] {
  const { start, end } = cycle;
  const daysTotal = differenceInDays(end, start) + 1;
  const dailyBudget = totalBudget / daysTotal;
  
  const result: DailySpending[] = [];
  let cumulativeActual = 0;
  const today = new Date();
  
  // Group transactions by date
  const spendingByDate = new Map<string, number>();
  transactions
    .filter(t => t.type === "expense")
    .forEach(t => {
      const dateKey = t.transaction_date;
      spendingByDate.set(dateKey, (spendingByDate.get(dateKey) || 0) + Number(t.amount));
    });
  
  for (let i = 0; i < daysTotal; i++) {
    const day = addDays(start, i);
    const dateKey = format(day, "yyyy-MM-dd");
    const dayNumber = i + 1;
    
    // Only include actual data up to today
    const isPast = isBefore(day, today) || isSameDay(day, today);
    const dailySpend = isPast ? (spendingByDate.get(dateKey) || 0) : 0;
    
    if (isPast) {
      cumulativeActual += dailySpend;
    }
    
    result.push({
      date: dateKey,
      actual: isPast ? dailySpend : 0,
      expected: dailyBudget,
      cumulative: isPast ? cumulativeActual : cumulativeActual, // Continue last known value
      expectedCumulative: dailyBudget * dayNumber,
    });
  }
  
  return result;
}

/**
 * Generate smart alerts based on pay cycle data
 */
export function generateAlerts(
  metrics: PayCycleMetrics,
  upcomingBills: Array<{ name: string; amount: number; dueDate: Date }>,
  birthdayEvents?: Array<{ person_name: string; event_month: number; event_day: number | null; budget: number }>,
): Alert[] {
  const alerts: Alert[] = [];
  
  // No data alert
  if (!metrics.hasData) {
    alerts.push({
      id: "no-data",
      type: "info",
      title: "Connect an account",
      message: "Link a bank account to see your spending insights.",
      action: {
        label: "Add Account",
        description: "Go to Accounts page to connect",
      },
    });
    return alerts;
  }
  
  // Over pace alert
  const paceVariance = metrics.totalSpent - metrics.expectedSpentByNow;
  if (paceVariance > 50) {
    const dailyReduction = metrics.daysRemaining > 0 
      ? Math.ceil(paceVariance / metrics.daysRemaining)
      : paceVariance;
    
    alerts.push({
      id: "over-pace",
      type: "warning",
      title: `£${Math.round(paceVariance)} over pace`,
      message: `Reduce daily spend to £${Math.round(metrics.safeToSpendPerDay)}/day to finish on target.`,
      action: {
        label: "Review spending",
        description: `Cut £${dailyReduction}/day for remaining ${metrics.daysRemaining} days`,
      },
    });
  }
  
  // Under budget (positive)
  if (paceVariance < -30 && metrics.daysPassed >= 5) {
    alerts.push({
      id: "under-budget",
      type: "success",
      title: "On track!",
      message: `You're £${Math.abs(Math.round(paceVariance))} below expected spend.`,
    });
  }
  
  // Runway risk alert
  if (metrics.runwayRisk && metrics.daysRemaining > 0) {
    const safeDaily = Math.round(metrics.safeToSpendPerDay);
    alerts.push({
      id: "runway-risk",
      type: "danger",
      title: "Low runway",
      message: `After bills, you'll have £${Math.round(metrics.discretionaryRemaining)} for ${metrics.daysRemaining} days (£${safeDaily}/day).`,
      action: {
        label: "Reduce spending",
        description: "Delay non-essential purchases until next payday",
      },
    });
  }
  
  // Projection alert
  if (metrics.projectedEndBalance.expected < 0) {
    alerts.push({
      id: "negative-projection",
      type: "danger",
      title: "Projected deficit",
      message: `At current pace, you'll end the cycle £${Math.abs(Math.round(metrics.projectedEndBalance.expected))} short.`,
      action: {
        label: "Reduce spending",
        description: `Target £${Math.round(metrics.safeToSpendPerDay)}/day maximum`,
      },
    });
  }
  
  // Large upcoming bills (next 3 days, > £100)
  const threeDaysFromNow = addDays(new Date(), 3);
  const largeBillsSoon = upcomingBills.filter(
    b => b.amount >= 100 && isBefore(b.dueDate, threeDaysFromNow)
  );
  
  largeBillsSoon.forEach(bill => {
    const daysUntil = differenceInDays(bill.dueDate, new Date());
    alerts.push({
      id: `bill-${bill.name}`,
      type: "info",
      title: `${bill.name} due ${daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`}`,
      message: `£${bill.amount.toFixed(2)} payment coming up.`,
    });
  });
  
  // Upcoming birthday / occasion alerts (within 7 days)
  if (birthdayEvents?.length) {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentDay = today.getDate();

    for (const ev of birthdayEvents) {
      const m = ev.event_month;
      const d = ev.event_day ?? 1;

      // Calculate days until this event (wrapping around year boundary)
      let targetDate = new Date(today.getFullYear(), m - 1, d);
      if (targetDate < today && differenceInDays(today, targetDate) > 0) {
        targetDate = new Date(today.getFullYear() + 1, m - 1, d);
      }
      const daysUntil = differenceInDays(targetDate, today);

      if (daysUntil >= 0 && daysUntil <= 7) {
        const when = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `in ${daysUntil} days`;
        const budgetNote = ev.budget > 0 ? ` (£${ev.budget} budgeted)` : "";
        alerts.push({
          id: `birthday-${ev.person_name}`,
          type: daysUntil <= 2 ? "warning" : "info",
          title: `🎂 ${ev.person_name}'s birthday ${when}`,
          message: `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][m - 1]}${budgetNote}`,
          action: daysUntil <= 2 ? {
            label: "Check gifts",
            description: "Make sure card and gift are ready",
          } : undefined,
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, showSign: boolean = false): string {
  const formatted = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  
  if (showSign && amount !== 0) {
    return amount > 0 ? `+${formatted}` : `-${formatted}`;
  }
  
  return amount < 0 ? `-${formatted}` : formatted;
}

/**
 * Get color class based on value (for balance changes, pace, etc.)
 */
export function getValueColorClass(value: number, inverse: boolean = false): string {
  if (value === 0) return "text-muted-foreground";
  const isPositive = inverse ? value < 0 : value > 0;
  return isPositive ? "text-success" : "text-destructive";
}

/**
 * Get safe-to-spend color based on daily amount
 */
export function getSafeToSpendColor(amount: number): "default" | "warning" | "danger" {
  if (amount >= 20) return "default";
  if (amount >= 10) return "warning";
  return "danger";
}
