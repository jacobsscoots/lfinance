import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { getBillOccurrencesForMonth } from "@/lib/billOccurrences";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth } from "date-fns";

export interface YearlyOverride {
  id: string;
  user_id: string;
  year: number;
  month: number;
  label: string;
  amount: number;
  type: 'income' | 'expense';
  created_at: string;
  updated_at: string;
}

export interface MonthData {
  month: number; // 0-11
  year: number;
  isPast: boolean;
  income: number;
  bills: number;
  discretionary: number;
  overrideIncome: number;
  overrideExpense: number;
  totalIncome: number;
  totalOutgoings: number;
  net: number;
  runningSurplus: number;
  overrides: YearlyOverride[];
}

export function useYearlyPlannerData(year: number) {
  const { user } = useAuth();
  const { bills } = useBills();
  const { effectiveSettings } = usePaydaySettings();
  const queryClient = useQueryClient();

  // Fetch overrides for the year
  const { data: overrides = [] } = useQuery({
    queryKey: ["yearly-planner-overrides", year, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("yearly_planner_overrides")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year);
      if (error) throw error;
      return data as YearlyOverride[];
    },
    enabled: !!user,
  });

  // Fetch actual transactions for the year (past months)
  const { data: yearTransactions = [] } = useQuery({
    queryKey: ["yearly-transactions", year, user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);
      if (!accounts?.length) return [];

      const accountIds = accounts.map(a => a.id);
      const { data, error } = await supabase
        .from("transactions")
        .select("transaction_date, type, amount, bill_id, description")
        .in("account_id", accountIds)
        .gte("transaction_date", `${year}-01-01`)
        .lte("transaction_date", `${year}-12-31`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Compute monthly income baseline from transactions
  const getMonthlyIncome = (): number => {
    // Get average monthly income from past transaction months
    const incomeByMonth: Record<string, number> = {};
    yearTransactions.forEach(t => {
      if (t.type === 'income') {
        const m = t.transaction_date.substring(0, 7); // YYYY-MM
        incomeByMonth[m] = (incomeByMonth[m] || 0) + Math.abs(Number(t.amount));
      }
    });
    const months = Object.values(incomeByMonth);
    if (months.length === 0) return 0;
    return months.reduce((s, v) => s + v, 0) / months.length;
  };

  // Build month data
  const monthData: MonthData[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const averageIncome = getMonthlyIncome();
  const activeBills = bills.filter(b => b.is_active);

  let runningSurplus = 0;

  for (let month = 0; month < 12; month++) {
    const isPast = year < currentYear || (year === currentYear && month < currentMonth);
    const isCurrent = year === currentYear && month === currentMonth;
    const monthOverrides = overrides.filter(o => o.month === month + 1);

    let income = 0;
    let discretionary = 0;
    let billsTotal = 0;

    if (isPast || isCurrent) {
      // Use actual data
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      yearTransactions.forEach(t => {
        if (t.transaction_date.startsWith(monthStr)) {
          const amt = Math.abs(Number(t.amount));
          if (t.type === 'income') {
            income += amt;
          } else if (t.bill_id) {
            billsTotal += amt;
          } else {
            discretionary += amt;
          }
        }
      });
    } else {
      // Future: use projected bills + average income
      income = averageIncome;
      const occurrences = getBillOccurrencesForMonth(activeBills, year, month);
      billsTotal = occurrences.reduce((s, o) => s + o.expectedAmount, 0);
      // Estimate discretionary from daily budget
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      discretionary = (effectiveSettings.daily_budget || 15) * daysInMonth;
    }

    const overrideIncome = monthOverrides
      .filter(o => o.type === 'income')
      .reduce((s, o) => s + Number(o.amount), 0);
    const overrideExpense = monthOverrides
      .filter(o => o.type === 'expense')
      .reduce((s, o) => s + Number(o.amount), 0);

    const totalIncome = income + overrideIncome;
    const totalOutgoings = billsTotal + discretionary + overrideExpense;
    const net = totalIncome - totalOutgoings;
    runningSurplus += net;

    monthData.push({
      month,
      year,
      isPast: isPast || isCurrent,
      income,
      bills: billsTotal,
      discretionary,
      overrideIncome,
      overrideExpense,
      totalIncome,
      totalOutgoings,
      net,
      runningSurplus,
      overrides: monthOverrides,
    });
  }

  // CRUD for overrides
  const createOverride = useMutation({
    mutationFn: async (data: { month: number; label: string; amount: number; type: 'income' | 'expense' }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("yearly_planner_overrides")
        .insert({
          user_id: user.id,
          year,
          month: data.month,
          label: data.label,
          amount: data.amount,
          type: data.type,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yearly-planner-overrides"] });
      toast.success("Adjustment added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteOverride = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("yearly_planner_overrides")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["yearly-planner-overrides"] });
      toast.success("Adjustment removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Build income breakdown: source name -> per-month amounts
  const incomeBreakdown: Record<string, number[]> = {};
  yearTransactions.forEach(t => {
    if (t.type !== 'income') return;
    const monthIdx = parseInt(t.transaction_date.substring(5, 7), 10) - 1;
    const source = t.description || 'Other Income';
    if (!incomeBreakdown[source]) incomeBreakdown[source] = new Array(12).fill(0);
    incomeBreakdown[source][monthIdx] += Math.abs(Number(t.amount));
  });

  return {
    monthData,
    overrides,
    incomeBreakdown,
    createOverride: createOverride.mutate,
    deleteOverride: deleteOverride.mutate,
    isCreating: createOverride.isPending,
  };
}
