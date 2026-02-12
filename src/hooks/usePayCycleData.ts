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
  
  const today = new Date();
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
  
  // Fetch bills
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
  
  // Income and expenses
  const totalIncome = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalSpent = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  // Get credit card account IDs to exclude from discretionary calc
  const creditAccountIds = new Set(
    allAccounts.filter(a => a.account_type === 'credit').map(a => a.id)
  );

  // Split actual spending into bill-linked vs discretionary
  // Only count transactions from non-credit accounts for discretionary budget tracking
  const nonCreditExpenses = transactions.filter(
    t => t.type === "expense" && !creditAccountIds.has(t.account_id)
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
  
  // Calculate balance excluding credit card accounts
  const nonCreditBalance = allAccounts
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
  const dailySpending = buildDailySpendingData(cycle, transactions, effectiveBudget);
  
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
  const alerts = generateAlerts(metrics, alertBills);
  
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
