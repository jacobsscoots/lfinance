import { Debt, DebtStatus } from "@/hooks/useDebts";
import { DebtPayment } from "@/hooks/useDebtPayments";
import { DebtBalanceSnapshot } from "@/hooks/useDebtSnapshots";
import { PayoffStrategy } from "@/hooks/useDebtSettings";
import { addMonths, differenceInDays, format, startOfMonth, endOfMonth, isWithinInterval, isBefore, isAfter, parseISO, getDaysInMonth } from "date-fns";

export interface DebtSummary {
  totalBalance: number;
  totalMinPayments: number;
  nextDueDate: Date | null;
  nextDueDebt: Debt | null;
  estimatedMonthlyInterest: number;
  estimatedDebtFreeDate: Date | null;
  totalStartingBalance: number;
  totalPaid: number;
  overallProgress: number;
}

export interface PayoffScheduleItem {
  debtId: string;
  creditorName: string;
  currentBalance: number;
  apr: number | null;
  minPayment: number;
  payoffDate: Date | null;
  totalInterest: number;
  monthlyAllocations: { month: string; amount: number }[];
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  monthlyBudget: number;
  debtFreeDate: Date | null;
  totalInterestPaid: number;
  schedule: PayoffScheduleItem[];
  monthlyBreakdown: { month: string; allocations: { debtId: string; amount: number }[] }[];
}

/**
 * Calculate summary statistics for all debts
 */
export function calculateDebtSummary(
  debts: Debt[],
  payments: DebtPayment[],
  monthlyBudget: number | null
): DebtSummary {
  const openDebts = debts.filter(d => d.status === 'open');
  
  const totalBalance = openDebts.reduce((sum, d) => sum + Number(d.current_balance), 0);
  const totalStartingBalance = openDebts.reduce((sum, d) => sum + Number(d.starting_balance), 0);
  const totalMinPayments = openDebts.reduce((sum, d) => sum + (Number(d.min_payment) || 0), 0);
  
  // Find next due date
  const today = new Date();
  const currentDay = today.getDate();
  
  let nextDueDate: Date | null = null;
  let nextDueDebt: Debt | null = null;
  
  for (const debt of openDebts) {
    if (debt.due_day) {
      let dueDate = new Date(today.getFullYear(), today.getMonth(), debt.due_day);
      if (dueDate <= today) {
        dueDate = addMonths(dueDate, 1);
      }
      if (!nextDueDate || dueDate < nextDueDate) {
        nextDueDate = dueDate;
        nextDueDebt = debt;
      }
    }
  }
  
  // Estimate monthly interest
  const estimatedMonthlyInterest = openDebts.reduce((sum, d) => {
    if (d.apr && d.interest_type !== 'none') {
      return sum + (Number(d.current_balance) * (Number(d.apr) / 100 / 12));
    }
    return sum;
  }, 0);
  
  // Calculate total paid from payments
  const totalPaid = payments
    .filter(p => p.category !== 'fee' && p.category !== 'adjustment')
    .reduce((sum, p) => {
      if (p.category === 'refund') return sum - Number(p.amount);
      return sum + Number(p.amount);
    }, 0);
  
  // Overall progress percentage
  const overallProgress = totalStartingBalance > 0
    ? ((totalStartingBalance - totalBalance) / totalStartingBalance) * 100
    : 0;
  
  // Estimate debt-free date
  let estimatedDebtFreeDate: Date | null = null;
  if (totalBalance > 0) {
    const effectiveMonthlyPayment = monthlyBudget || calculateAverageMonthlyPayment(payments);
    if (effectiveMonthlyPayment > 0) {
      // Simple projection (ignoring interest for rough estimate)
      const monthsToPayoff = Math.ceil(totalBalance / effectiveMonthlyPayment);
      estimatedDebtFreeDate = addMonths(today, monthsToPayoff);
    }
  }
  
  return {
    totalBalance,
    totalMinPayments,
    nextDueDate,
    nextDueDebt,
    estimatedMonthlyInterest,
    estimatedDebtFreeDate,
    totalStartingBalance,
    totalPaid,
    overallProgress,
  };
}

/**
 * Calculate average monthly payment from last 90 days
 */
export function calculateAverageMonthlyPayment(payments: DebtPayment[]): number {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentPayments = payments.filter(p => {
    const date = parseISO(p.payment_date);
    return date >= ninetyDaysAgo && p.category !== 'fee' && p.category !== 'adjustment';
  });
  
  const totalAmount = recentPayments.reduce((sum, p) => {
    if (p.category === 'refund') return sum - Number(p.amount);
    return sum + Number(p.amount);
  }, 0);
  
  return totalAmount / 3; // 3 months
}

/**
 * Calculate progress percentage for a single debt
 */
export function calculateDebtProgress(debt: Debt): number {
  const starting = Number(debt.starting_balance);
  const current = Number(debt.current_balance);
  
  if (starting <= 0) return 100;
  if (current <= 0) return 100;
  if (current >= starting) return 0;
  
  return ((starting - current) / starting) * 100;
}

/**
 * Get payments grouped by month
 */
export function getPaymentsByMonth(payments: DebtPayment[]): Map<string, number> {
  const byMonth = new Map<string, number>();
  
  for (const payment of payments) {
    if (payment.category === 'fee') continue;
    
    const month = format(parseISO(payment.payment_date), 'yyyy-MM');
    const current = byMonth.get(month) || 0;
    const amount = payment.category === 'refund' 
      ? -Number(payment.amount)
      : Number(payment.amount);
    byMonth.set(month, current + amount);
  }
  
  return byMonth;
}

/**
 * Calculate balance history using snapshots and payments
 */
export function calculateBalanceHistory(
  debt: Debt,
  payments: DebtPayment[],
  snapshots: DebtBalanceSnapshot[],
  months: number = 12
): { date: string; balance: number }[] {
  const history: { date: string; balance: number }[] = [];
  const today = new Date();
  
  // Sort snapshots and payments by date
  const debtSnapshots = snapshots
    .filter(s => s.debt_id === debt.id)
    .sort((a, b) => parseISO(a.snapshot_date).getTime() - parseISO(b.snapshot_date).getTime());
  
  const debtPayments = payments
    .filter(p => p.debt_id === debt.id)
    .sort((a, b) => parseISO(a.payment_date).getTime() - parseISO(b.payment_date).getTime());
  
  // Start from opening or months ago
  const startDate = debt.opened_date 
    ? parseISO(debt.opened_date)
    : addMonths(today, -months);
  
  let currentDate = startOfMonth(startDate);
  let currentBalance = Number(debt.starting_balance);
  
  while (currentDate <= today) {
    const monthEnd = endOfMonth(currentDate);
    const monthStr = format(currentDate, 'yyyy-MM');
    
    // Check for snapshot in this month (prefer statement snapshots)
    const monthSnapshot = debtSnapshots.find(s => {
      const snapDate = parseISO(s.snapshot_date);
      return isWithinInterval(snapDate, { start: currentDate, end: monthEnd });
    });
    
    if (monthSnapshot) {
      currentBalance = Number(monthSnapshot.balance);
    } else {
      // Apply payments for this month
      const monthPayments = debtPayments.filter(p => {
        const payDate = parseISO(p.payment_date);
        return isWithinInterval(payDate, { start: currentDate, end: monthEnd });
      });
      
      for (const payment of monthPayments) {
        if (payment.category === 'fee' || payment.category === 'adjustment') {
          currentBalance += Number(payment.amount);
        } else if (payment.category === 'refund') {
          currentBalance += Number(payment.amount);
        } else {
          currentBalance -= Number(payment.amount);
        }
      }
    }
    
    history.push({
      date: monthStr,
      balance: Math.max(0, currentBalance),
    });
    
    currentDate = addMonths(currentDate, 1);
  }
  
  return history;
}

/**
 * Generate payoff plan using Avalanche or Snowball strategy
 */
export function generatePayoffPlan(
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayoffStrategy
): PayoffPlan {
  const openDebts = debts.filter(d => d.status === 'open');
  
  if (openDebts.length === 0 || monthlyBudget <= 0) {
    return {
      strategy,
      monthlyBudget,
      debtFreeDate: null,
      totalInterestPaid: 0,
      schedule: [],
      monthlyBreakdown: [],
    };
  }
  
  // Clone debts for simulation
  const debtSimulation = openDebts.map(d => ({
    id: d.id,
    creditorName: d.creditor_name,
    balance: Number(d.current_balance),
    apr: d.apr ? Number(d.apr) : 0,
    minPayment: Number(d.min_payment) || 0,
    paidOff: false,
    payoffDate: null as Date | null,
    totalInterest: 0,
    monthlyAllocations: [] as { month: string; amount: number }[],
  }));
  
  // Sort by strategy
  const sortedDebts = [...debtSimulation].sort((a, b) => {
    if (strategy === 'avalanche') {
      return b.apr - a.apr; // Highest APR first
    } else {
      return a.balance - b.balance; // Lowest balance first
    }
  });
  
  const monthlyBreakdown: { month: string; allocations: { debtId: string; amount: number }[] }[] = [];
  let currentMonth = new Date();
  let totalInterestPaid = 0;
  let maxIterations = 360; // 30 years max
  
  while (sortedDebts.some(d => !d.paidOff) && maxIterations > 0) {
    maxIterations--;
    const monthStr = format(currentMonth, 'yyyy-MM');
    let remainingBudget = monthlyBudget;
    const allocations: { debtId: string; amount: number }[] = [];
    
    // First, apply interest
    for (const debt of sortedDebts) {
      if (debt.paidOff) continue;
      
      const monthlyInterest = debt.balance * (debt.apr / 100 / 12);
      debt.balance += monthlyInterest;
      debt.totalInterest += monthlyInterest;
      totalInterestPaid += monthlyInterest;
    }
    
    // Second, pay minimums on all debts
    for (const debt of sortedDebts) {
      if (debt.paidOff) continue;
      
      const payment = Math.min(debt.minPayment, debt.balance, remainingBudget);
      if (payment > 0) {
        debt.balance -= payment;
        remainingBudget -= payment;
        allocations.push({ debtId: debt.id, amount: payment });
        debt.monthlyAllocations.push({ month: monthStr, amount: payment });
        
        if (debt.balance <= 0.01) {
          debt.balance = 0;
          debt.paidOff = true;
          debt.payoffDate = currentMonth;
        }
      }
    }
    
    // Third, put extra on target debt (first non-paid-off in sorted order)
    for (const debt of sortedDebts) {
      if (debt.paidOff || remainingBudget <= 0) continue;
      
      const extraPayment = Math.min(remainingBudget, debt.balance);
      if (extraPayment > 0) {
        debt.balance -= extraPayment;
        remainingBudget -= extraPayment;
        
        // Add to existing allocation or create new
        const existingAlloc = allocations.find(a => a.debtId === debt.id);
        if (existingAlloc) {
          existingAlloc.amount += extraPayment;
          const lastMonthlyAlloc = debt.monthlyAllocations.find(a => a.month === monthStr);
          if (lastMonthlyAlloc) lastMonthlyAlloc.amount += extraPayment;
        } else {
          allocations.push({ debtId: debt.id, amount: extraPayment });
          debt.monthlyAllocations.push({ month: monthStr, amount: extraPayment });
        }
        
        if (debt.balance <= 0.01) {
          debt.balance = 0;
          debt.paidOff = true;
          debt.payoffDate = currentMonth;
        }
      }
      break; // Only put extra on one debt per month
    }
    
    monthlyBreakdown.push({ month: monthStr, allocations });
    currentMonth = addMonths(currentMonth, 1);
  }
  
  // Find debt-free date (last payoff date)
  const debtFreeDate = sortedDebts
    .filter(d => d.payoffDate)
    .reduce((latest, d) => {
      if (!latest || (d.payoffDate && d.payoffDate > latest)) {
        return d.payoffDate;
      }
      return latest;
    }, null as Date | null);
  
  const schedule: PayoffScheduleItem[] = debtSimulation.map(d => ({
    debtId: d.id,
    creditorName: d.creditorName,
    currentBalance: openDebts.find(od => od.id === d.id)?.current_balance || 0,
    apr: d.apr || null,
    minPayment: d.minPayment,
    payoffDate: d.payoffDate,
    totalInterest: d.totalInterest,
    monthlyAllocations: d.monthlyAllocations,
  }));
  
  return {
    strategy,
    monthlyBudget,
    debtFreeDate,
    totalInterestPaid,
    schedule,
    monthlyBreakdown,
  };
}

/**
 * Calculate interest saved comparing two strategies
 */
export function calculateInterestSaved(
  debts: Debt[],
  monthlyBudget: number
): { avalancheInterest: number; snowballInterest: number; saved: number } {
  const avalanchePlan = generatePayoffPlan(debts, monthlyBudget, 'avalanche');
  const snowballPlan = generatePayoffPlan(debts, monthlyBudget, 'snowball');
  
  return {
    avalancheInterest: avalanchePlan.totalInterestPaid,
    snowballInterest: snowballPlan.totalInterestPaid,
    saved: snowballPlan.totalInterestPaid - avalanchePlan.totalInterestPaid,
  };
}

/**
 * Get debt type display label
 */
export function getDebtTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    credit_card: 'Credit Card',
    loan: 'Loan',
    overdraft: 'Overdraft',
    bnpl: 'Buy Now Pay Later',
    other: 'Other',
  };
  return labels[type] || type;
}

/**
 * Get payment category display label
 */
export function getPaymentCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    extra: 'Extra',
    fee: 'Fee',
    refund: 'Refund',
    adjustment: 'Adjustment',
  };
  return labels[category] || category;
}
