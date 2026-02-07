import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { startOfMonth, endOfMonth, addDays, isBefore, isAfter, format } from "date-fns";
import { getCurrentPayCycle, PaydaySettings } from "@/lib/payday";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import type { Tables } from "@/integrations/supabase/types";

type Transaction = Tables<"transactions">;
type Bill = Tables<"bills">;

// Hook for fetching total balance from all accounts
export function useTotalBalance() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["total-balance", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("balance")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      return data.reduce((sum, account) => sum + Number(account.balance), 0);
    },
    enabled: !!user,
  });
}

// Hook for monthly income and expenses summary
export function useMonthSummary(date: Date = new Date()) {
  const { user } = useAuth();
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  
  return useQuery({
    queryKey: ["month-summary", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return { income: 0, outgoings: 0, net: 0 };
      
      // First get user's account IDs
      const { data: accounts, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);
      
      if (accountsError) throw accountsError;
      if (!accounts || accounts.length === 0) {
        return { income: 0, outgoings: 0, net: 0 };
      }
      
      const accountIds = accounts.map(a => a.id);
      
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .in("account_id", accountIds)
        .gte("transaction_date", format(monthStart, "yyyy-MM-dd"))
        .lte("transaction_date", format(monthEnd, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      const income = transactions
        ?.filter(t => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      const outgoings = transactions
        ?.filter(t => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      return {
        income,
        outgoings,
        net: income - outgoings,
      };
    },
    enabled: !!user,
  });
}

// Hook for pay cycle spending summary
export function usePayCycleSummary(date: Date = new Date()) {
  const { user } = useAuth();
  const { effectiveSettings } = usePaydaySettings();
  
  const paydayConfig: PaydaySettings = {
    paydayDate: effectiveSettings.payday_date,
    adjustmentRule: effectiveSettings.adjustment_rule,
  };
  
  const { start, end } = getCurrentPayCycle(date, paydayConfig);
  
  return useQuery({
    queryKey: ["pay-cycle-summary", user?.id, format(start, "yyyy-MM-dd"), effectiveSettings.payday_date, effectiveSettings.adjustment_rule],
    queryFn: async () => {
      if (!user) return { spent: 0, budget: 0, percentUsed: 0 };
      
      // First get user's account IDs
      const { data: accounts, error: accountsError } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);
      
      if (accountsError) throw accountsError;
      if (!accounts || accounts.length === 0) {
        return { spent: 0, budget: 0, percentUsed: 0 };
      }
      
      const accountIds = accounts.map(a => a.id);
      
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("amount, type")
        .in("account_id", accountIds)
        .eq("type", "expense")
        .gte("transaction_date", format(start, "yyyy-MM-dd"))
        .lte("transaction_date", format(end, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      const spent = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      
      // Budget calculation: Get total balance as a rough budget for now
      // In a future iteration, this could be user-configurable
      const { data: balanceData } = await supabase
        .from("bank_accounts")
        .select("balance")
        .eq("user_id", user.id);
      
      const totalBalance = balanceData?.reduce((sum, a) => sum + Number(a.balance), 0) || 0;
      const budget = totalBalance + spent; // Original budget before spending
      const percentUsed = budget > 0 ? (spent / budget) * 100 : 0;
      
      return {
        spent,
        budget,
        percentUsed: Math.min(percentUsed, 100),
      };
    },
    enabled: !!user,
  });
}

// Helper to get next occurrence of a bill
function getNextBillDueDate(bill: Bill, fromDate: Date = new Date()): Date | null {
  const today = fromDate;
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // For monthly bills, calculate next occurrence based on due_day
  let dueDate = new Date(currentYear, currentMonth, bill.due_day);
  
  // If this month's due date has passed, move to next month
  if (isBefore(dueDate, today)) {
    dueDate = new Date(currentYear, currentMonth + 1, bill.due_day);
  }
  
  // Check if bill is within active date range
  if (bill.start_date && isBefore(dueDate, new Date(bill.start_date))) {
    return null;
  }
  if (bill.end_date && isAfter(dueDate, new Date(bill.end_date))) {
    return null;
  }
  
  return dueDate;
}

// Hook for upcoming bills in the next N days
export function useUpcomingBills(days: number = 7) {
  const { user } = useAuth();
  const today = new Date();
  const endDate = addDays(today, days);
  
  return useQuery({
    queryKey: ["upcoming-bills", user?.id, days],
    queryFn: async () => {
      if (!user) return { bills: [], total: 0 };
      
      const { data: bills, error } = await supabase
        .from("bills")
        .select(`
          *,
          category:categories(name, color, icon)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true);
      
      if (error) throw error;
      
      // Filter and map bills to include computed due dates
      const upcomingBills = bills
        ?.map(bill => {
          const dueDate = getNextBillDueDate(bill, today);
          return { ...bill, dueDate };
        })
        .filter(bill => {
          if (!bill.dueDate) return false;
          return !isBefore(bill.dueDate, today) && !isAfter(bill.dueDate, endDate);
        })
        .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0)) || [];
      
      const total = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount), 0);
      
      return { bills: upcomingBills, total };
    },
    enabled: !!user,
  });
}
