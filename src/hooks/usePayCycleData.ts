import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { useAccounts } from "@/hooks/useAccounts";
import { 
  format, 
  differenceInDays, 
  isBefore, 
  isAfter, 
  isSameDay,
  addDays,
  subDays,
  startOfDay,
} from "date-fns";
import { getPayCycleForDate, toPaydaySettings, type PayCycle } from "@/lib/payCycle";
import { generateBillOccurrences } from "@/lib/billOccurrences";
import {
  calculateSafeToSpend,
  calculateProjectedEndBalance,
  checkRunwayRisk,
  buildDailySpendingData,
  generateAlerts,
  type PayCycleMetrics,
  type Alert,
} from "@/lib/dashboardCalculations";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;
type Bill = Tables<"bills">;

// Patterns that indicate internal transfers, not real outgoings
const TRANSFER_PATTERNS = [
  /\[transfer out\]/i,
  /\[transfer in\]/i,
  /^chip$/i,
  /saving challenge/i,
  /chipx investing/i,
  /moved to pot/i,
  /pot transfer/i,
];

function isInternalTransfer(t: Transaction): boolean {
  const desc = t.description || "";
  return TRANSFER_PATTERNS.some(p => p.test(desc));
}

/**
 * Deduplicate transactions: if same date + amount + description appears multiple times
 * in the same account, only count the first occurrence.
 */
function deduplicateTransactions(txns: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return txns.filter(t => {
    const key = `${t.account_id}-${t.transaction_date}-${Number(t.amount).toFixed(2)}-${t.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface BillWithDueDate extends Bill {
  dueDate: Date;
  category?: {
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

interface AccountWithChange {
  id: string;
  name: string;
  displayName: string | null;
  balance: number;
  changeFromStart: number;
  isHidden: boolean;
  lastSyncedAt: string | null;
}

export interface PayCycleDataResult {
  // Cycle info
  cycle: PayCycle;
  cycleLabel: string;
  
  // Core metrics
  metrics: PayCycleMetrics;
  
  // Bills
  upcomingBills: BillWithDueDate[];
  billsNext7Days: BillWithDueDate[];
  billsRestOfCycle: BillWithDueDate[];
  totalNext7Days: number;
  totalRestOfCycle: number;
  
  // Actual spending breakdown
  billLinkedSpent: number;
  discretionarySpent: number;
  
  // Outgoings breakdown for drill-down
  outgoingsBreakdown: Array<{
    id: string;
    description: string;
    amount: number;
    date: string;
    accountName: string;
    isBillLinked: boolean;
    isTransferExcluded: boolean;
    isDuplicate: boolean;
  }>;
  
  // Alerts
  alerts: Alert[];
  
  // Accounts
  accounts: AccountWithChange[];
  
  // Loading state
  isLoading: boolean;
}


export function usePayCycleData(referenceDate: Date = new Date()): PayCycleDataResult {
  const { user } = useAuth();
  const { effectiveSettings, isLoading: settingsLoading } = usePaydaySettings();
  const { allAccounts, totalBalance, isLoading: accountsLoading } = useAccounts();
  
  // Get current pay cycle
  const paydayConfig = toPaydaySettings(effectiveSettings);
  const cycle = getPayCycleForDate(referenceDate, paydayConfig);
  
  const today = startOfDay(new Date());
  const daysTotal = differenceInDays(cycle.end, cycle.start) + 1;
  const daysPassed = Math.max(0, differenceInDays(today, cycle.start) + 1);
  const daysRemaining = Math.max(0, differenceInDays(cycle.end, today) + 1);
  
  // Fetch transactions for this cycle
  const transactionsQuery = useQuery({
    queryKey: ["pay-cycle-transactions", user?.id, format(cycle.start, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user) return [];
      
      // Get all visible account IDs
      const visibleAccounts = allAccounts.filter(a => !a.is_hidden);
      if (visibleAccounts.length === 0) return [];
      
      const accountIds = visibleAccounts.map(a => a.id);
      
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountIds)
        .gte("transaction_date", format(cycle.start, "yyyy-MM-dd"))
        .lte("transaction_date", format(cycle.end, "yyyy-MM-dd"))
        .order("transaction_date", { ascending: true });
      
      if (error) throw error;
      return data as Transaction[];
    },
    enabled: !!user && !accountsLoading && allAccounts.length > 0,
  });
  
  // Fetch birthday events for alerts
  const birthdayQuery = useQuery({
    queryKey: ["pay-cycle-birthdays", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("birthday_events")
        .select("person_name, event_month, event_day, budget, card_sent, money_scheduled")
        .eq("user_id", user.id)
        .eq("is_active", true);
      if (error) throw error;
      return data as Array<{ person_name: string; event_month: number; event_day: number | null; budget: number; card_sent: boolean | null; money_scheduled: boolean | null }>;
    },
    enabled: !!user,
  });
  const billsQuery = useQuery({
    queryKey: ["pay-cycle-bills", user?.id, format(cycle.start, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          category:categories(name, color, icon)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true);
      
      if (error) throw error;
      return data as (Bill & { category?: { name: string; color: string | null; icon: string | null } | null })[];
    },
    enabled: !!user,
  });
  
  // Calculate derived values
  const transactions = transactionsQuery.data || [];
  const bills = billsQuery.data || [];
  
  // Deduplicate and filter transfers
  const cleanTransactions = deduplicateTransactions(transactions);
  const realExpenses = cleanTransactions.filter(t => t.type === "expense" && !isInternalTransfer(t));
  const realIncome = cleanTransactions.filter(t => t.type === "income" && !isInternalTransfer(t));

  // Income and expenses (from deduplicated, non-transfer transactions)
  const totalIncome = realIncome
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalSpent = realExpenses
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Identify the Monzo current account for safe-to-spend calculations
  const monzoCurrentAccount = allAccounts.find(
    a => !a.is_hidden && a.provider === 'ob-monzo' && a.account_type === 'current'
  );

  // Get credit card account IDs to exclude from discretionary calc
  const creditAccountIds = new Set(
    allAccounts.filter(a => a.account_type === 'credit').map(a => a.id)
  );

  // Split actual spending into bill-linked vs discretionary
  // Only count transactions from the Monzo current account for discretionary budget tracking
  const spendingAccountIds = monzoCurrentAccount 
    ? new Set([monzoCurrentAccount.id])
    : new Set(allAccounts.filter(a => !a.is_hidden && a.account_type !== 'credit').map(a => a.id));
  const nonCreditExpenses = realExpenses.filter(
    t => spendingAccountIds.has(t.account_id)
  );
  const billLinkedSpent = nonCreditExpenses
    .filter(t => t.bill_id)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const discretionarySpent = nonCreditExpenses
    .filter(t => !t.bill_id)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Calculate start balance (current + expenses - income since cycle start)
  const startBalance = totalBalance + totalSpent - totalIncome;
  
  // Get bills due in remaining cycle using proper frequency-aware occurrence generator
  const upcomingBills: BillWithDueDate[] = bills
    .flatMap(bill => {
      const occurrences = generateBillOccurrences(bill as any, today, cycle.end);
      return occurrences.map(occ => ({
        ...bill,
        dueDate: occ.dueDate,
      }));
    })
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  
  // Split bills by timeframe
  const sevenDaysFromNow = addDays(today, 7);
  const billsNext7Days = upcomingBills.filter(b => 
    isBefore(b.dueDate, sevenDaysFromNow) || isSameDay(b.dueDate, sevenDaysFromNow)
  );
  const billsRestOfCycle = upcomingBills.filter(b => 
    isAfter(b.dueDate, sevenDaysFromNow)
  );
  
  const totalNext7Days = billsNext7Days.reduce((sum, b) => sum + Number(b.amount), 0);
  const totalRestOfCycle = billsRestOfCycle.reduce((sum, b) => sum + Number(b.amount), 0);
  const committedRemaining = totalNext7Days + totalRestOfCycle;
  
  // Calculate balance using only the Monzo current account for safe-to-spend
  const nonCreditBalance = monzoCurrentAccount ? Number(monzoCurrentAccount.balance) : 
    allAccounts
      .filter(a => !a.is_hidden && a.account_type !== 'credit')
      .reduce((sum, a) => sum + Number(a.balance), 0);
  
  // "Restart from today" runway calculation
  // Today's spend from non-credit accounts (local timezone)
  const todayStr = format(today, "yyyy-MM-dd");
  const spentToday = nonCreditExpenses
    .filter(t => t.transaction_date === todayStr)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  // Anchor balance = what we had at start of today (current balance + what we spent today)
  const anchorBalance = nonCreditBalance + spentToday;
  
  // Safe-to-spend: current balance / days remaining (balance already reflects posted transactions)
  const safeToSpendPerDay = daysRemaining > 0 ? nonCreditBalance / daysRemaining : 0;
  const discretionaryRemaining = nonCreditBalance;
  
  // Budget buffer tracking
  const dailyBudget = effectiveSettings.daily_budget;
  const planRemaining = dailyBudget * daysRemaining; // includes today
  const bufferStart = anchorBalance - planRemaining;
  const bufferTomorrow = daysRemaining > 1
    ? nonCreditBalance - (dailyBudget * (daysRemaining - 1))
    : nonCreditBalance; // last day: whatever's left is buffer
  
  // Budget for pace calculation (income if available, otherwise start balance)
  const effectiveBudget = totalIncome > 0 ? totalIncome : startBalance;
  const expectedSpentByNow = daysTotal > 0 ? (effectiveBudget / daysTotal) * daysPassed : 0;
  
  const projectedEndBalance = calculateProjectedEndBalance(
    nonCreditBalance,
    totalSpent,
    daysPassed,
    daysRemaining,
    committedRemaining
  );

  const isOverPace = totalSpent > expectedSpentByNow + 50;
  const runwayRisk = checkRunwayRisk(discretionaryRemaining, daysRemaining);
  
  // Build daily spending data for charts
  const dailySpending = buildDailySpendingData(cycle, cleanTransactions.filter(t => !isInternalTransfer(t)), effectiveBudget);
  
  // Buffer = projected end balance in best case
  const bufferAmount = projectedEndBalance.best;
  
  const hasData = allAccounts.length > 0;
  
  const metrics: PayCycleMetrics = {
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
    daysTotal,
    daysRemaining,
    daysPassed,
    startBalance,
    currentBalance: nonCreditBalance,
    projectedEndBalance,
    anchorBalance,
    spentToday,
    remainingBalance: nonCreditBalance,
    dailyBudget,
    planRemaining,
    bufferStart,
    bufferTomorrow,
    totalSpent,
    totalIncome,
    expectedSpentByNow,
    safeToSpendPerDay,
    committedRemaining,
    discretionaryRemaining,
    bufferAmount,
    isOverPace,
    runwayRisk,
    hasData,
    dailySpending,
  };
  
  // Generate alerts
  const alertBills = upcomingBills.map(b => ({
    name: b.name,
    amount: Number(b.amount),
    dueDate: b.dueDate,
  }));
  const alerts = generateAlerts(metrics, alertBills, birthdayQuery.data ?? []);
  
  // Build account list with changes
  const accounts: AccountWithChange[] = allAccounts.map(account => {
    // Get transactions for this account in cycle
    const accountTransactions = transactions.filter(t => t.account_id === account.id);
    const accountIncome = accountTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const accountExpenses = accountTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    
    const changeFromStart = accountIncome - accountExpenses;
    
    return {
      id: account.id,
      name: account.name,
      displayName: account.display_name,
      balance: Number(account.balance),
      changeFromStart,
      isHidden: account.is_hidden,
      lastSyncedAt: account.last_synced_at,
    };
  });
  
  // Build outgoings breakdown for drill-down
  const accountNameMap = new Map(allAccounts.map(a => [a.id, a.display_name || a.name]));
  const dedupedAll = deduplicateTransactions(transactions);
  const dedupKeys = new Set(dedupedAll.map(t => t.id));
  
  const outgoingsBreakdown = transactions
    .filter(t => t.type === "expense")
    .map(t => ({
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      date: t.transaction_date,
      accountName: accountNameMap.get(t.account_id) || "Unknown",
      isBillLinked: !!t.bill_id,
      isTransferExcluded: isInternalTransfer(t),
      isDuplicate: !dedupKeys.has(t.id),
    }))
    .sort((a, b) => b.amount - a.amount);
  
  // Cycle label
  const cycleLabel = `${format(cycle.start, "d MMM")} → ${format(cycle.end, "d MMM yyyy")}`;
  
  const isLoading = settingsLoading || accountsLoading || transactionsQuery.isLoading || billsQuery.isLoading;
  
  return {
    cycle,
    cycleLabel,
    metrics,
    upcomingBills,
    billsNext7Days,
    billsRestOfCycle,
    totalNext7Days,
    totalRestOfCycle,
    billLinkedSpent,
    discretionarySpent,
    outgoingsBreakdown,
    alerts,
    accounts,
    isLoading,
  };
}

// Hook for historical pay cycles (for net trend chart)
export function useHistoricalPayCycles(numberOfCycles: number = 6) {
  const { user } = useAuth();
  const { effectiveSettings, isLoading: settingsLoading } = usePaydaySettings();
  const { allAccounts, isLoading: accountsLoading } = useAccounts();
  
  const paydayConfig = toPaydaySettings(effectiveSettings);
  
  // Generate past cycle dates
  const cycles: PayCycle[] = [];
  let currentDate = new Date();
  
  for (let i = 0; i < numberOfCycles; i++) {
    const cycle = getPayCycleForDate(currentDate, paydayConfig);
    cycles.push(cycle);
    currentDate = subDays(cycle.start, 1); // Move to previous cycle
  }
  
  return useQuery({
    queryKey: ["historical-pay-cycles", user?.id, numberOfCycles, effectiveSettings.payday_date],
    queryFn: async () => {
      if (!user || allAccounts.length === 0) return [];
      
      const visibleAccounts = allAccounts.filter(a => !a.is_hidden);
      const accountIds = visibleAccounts.map(a => a.id);
      
      // Get the earliest and latest dates we need
      const earliest = cycles[cycles.length - 1].start;
      const latest = cycles[0].end;
      
      const { data, error } = await supabase
        .from("transactions")
        .select("amount, type, transaction_date")
        .in("account_id", accountIds)
        .gte("transaction_date", format(earliest, "yyyy-MM-dd"))
        .lte("transaction_date", format(latest, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      // Group by cycle
      return cycles.map(cycle => {
        const cycleTransactions = (data || []).filter(t => {
          const date = new Date(t.transaction_date);
          return (isAfter(date, cycle.start) || isSameDay(date, cycle.start)) &&
                 (isBefore(date, cycle.end) || isSameDay(date, cycle.end));
        });
        
        const income = cycleTransactions
          .filter(t => t.type === "income")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        const expenses = cycleTransactions
          .filter(t => t.type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);
        
        return {
          cycleStart: cycle.start,
          cycleEnd: cycle.end,
          label: format(cycle.start, "MMM"),
          income,
          expenses,
          net: income - expenses,
          hasData: cycleTransactions.length > 0,
        };
      }).reverse(); // Oldest first for chart
    },
    enabled: !!user && !settingsLoading && !accountsLoading && allAccounts.length > 0,
  });
}
