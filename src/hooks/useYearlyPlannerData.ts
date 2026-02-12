import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { useGroceryForecast } from "@/hooks/useGroceryForecast";
import { getBillOccurrencesForMonth } from "@/lib/billOccurrences";
import { toast } from "sonner";

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
  isEstimated: boolean;
  income: number;
  bills: number;
  groceryForecast: number;
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
  const { monthlySpend: groceryMonthlyForecast } = useGroceryForecast();
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

  // Fetch payslips to estimate salary for future months
  const { data: payslips = [] } = useQuery({
    queryKey: ["yearly-payslips", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("payslips")
        .select("net_pay, pay_date, employer_name")
        .eq("user_id", user.id)
        .not("net_pay", "is", null)
        .order("pay_date", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Only count tracked income sources for the planner (non-salary ones)
  const TRACKED_INCOME_PATTERNS = [
    /rent\s*from\s*sarah/i,
    /faster\s*payments.*sarah/i,
  ];

  // Display-friendly names for tracked income sources
  const TRACKED_INCOME_LABELS: Record<string, string> = {};
  const getTrackedIncomeLabel = (description: string): string => {
    if (/rent\s*from\s*sarah/i.test(description) || /faster\s*payments.*sarah/i.test(description)) {
      return "Help from Mum for Rent";
    }
    return description;
  };

  const isTrackedIncome = (description: string): boolean =>
    TRACKED_INCOME_PATTERNS.some(p => p.test(description));

  // Compute monthly income baseline from tracked income transactions only
  const getMonthlyTrackedIncome = (): number => {
    const incomeByMonth: Record<string, number> = {};
    yearTransactions.forEach(t => {
      if (t.type === 'income' && isTrackedIncome(t.description)) {
        const m = t.transaction_date.substring(0, 7);
        incomeByMonth[m] = (incomeByMonth[m] || 0) + Math.abs(Number(t.amount));
      }
    });
    const months = Object.values(incomeByMonth);
    if (months.length === 0) return 0;
    return months.reduce((s, v) => s + v, 0) / months.length;
  };

  // Get estimated salary from latest payslip
  const estimatedSalary = payslips.length > 0 && payslips[0].net_pay
    ? Number(payslips[0].net_pay)
    : 0;
  const salaryEmployer = payslips.length > 0 ? payslips[0].employer_name || "Salary" : "Salary";

  // Build month data
  const monthData: MonthData[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const averageTrackedIncome = getMonthlyTrackedIncome();
  const activeBills = bills.filter(b => b.is_active);

  // April 2026 inflation adjustments (researched from official/reputable sources)
  // Bills in a fixed-term contract are excluded (Broadband/Fibrely, Electric)
  const APRIL_2026_INFLATION: Record<string, { type: 'percent' | 'flat' | 'fixed'; value: number; source: string }> = {
    'Council Tax':        { type: 'percent', value: 5,    source: 'Gov 5% referendum cap 2026/27' },
    'TV License':         { type: 'fixed',   value: 180,  source: 'BBC/Gov confirmed £180 from Apr 2026' },
    'TV Licence':         { type: 'fixed',   value: 180,  source: 'BBC/Gov confirmed £180 from Apr 2026' },
    'EE Phone Payment':   { type: 'flat',    value: 4,    source: 'EE handset plan +£4/mo (Uswitch/EE confirmed)' },
    // Protected by contract — NO increase:
    // 'Broadband' (Fibrely, in 18-month contract)
    // 'Electric' (in fixed-term contract)
  };

  const getInflationAdjustedAmount = (billName: string, baseAmount: number, yr: number, mo: number): number => {
    // Only apply from April 2026 onwards
    if (yr < 2026 || (yr === 2026 && mo < 3)) return baseAmount; // mo is 0-indexed, April = 3
    const rule = APRIL_2026_INFLATION[billName];
    if (!rule) return baseAmount;
    if (rule.type === 'percent') return baseAmount * (1 + rule.value / 100);
    if (rule.type === 'flat') return baseAmount + rule.value;
    if (rule.type === 'fixed') return rule.value / (billName.toLowerCase().includes('tv') ? 1 : 1); // fixed annual → return as-is, occurrence engine handles frequency
    return baseAmount;
  };

  let runningSurplus = 0;

  for (let month = 0; month < 12; month++) {
    const isPast = year < currentYear || (year === currentYear && month < currentMonth);
    const isCurrent = year === currentYear && month === currentMonth;
    const isEstimated = !isPast && !isCurrent;
    const monthOverrides = overrides.filter(o => o.month === month + 1);

    let income = 0;
    let discretionary = 0;
    let billsTotal = 0;
    let groceryForecast = 0;

    if (isPast || isCurrent) {
      // Use actual data - only tracked income sources
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
      yearTransactions.forEach(t => {
        if (t.transaction_date.startsWith(monthStr)) {
          const amt = Math.abs(Number(t.amount));
          if (t.type === 'income' && isTrackedIncome(t.description)) {
            income += amt;
          } else if (t.type === 'expense' && t.bill_id) {
            billsTotal += amt;
          }
        }
      });

      // Check if salary transaction exists for this month
      const hasSalaryTransaction = yearTransactions.some(t =>
        t.transaction_date.startsWith(monthStr) &&
        t.type === 'income' &&
        !isTrackedIncome(t.description) &&
        Math.abs(Number(t.amount)) > 500 // salary-level income
      );

      // If current month and no salary yet, add estimated salary
      if (isCurrent && !hasSalaryTransaction && estimatedSalary > 0) {
        income += estimatedSalary;
      }
    } else {
      // Future: use projected salary + tracked income average + projected bills + grocery forecast
      income = estimatedSalary + averageTrackedIncome;
      const occurrences = getBillOccurrencesForMonth(activeBills, year, month);
      billsTotal = occurrences.reduce((s, o) => s + getInflationAdjustedAmount(o.billName, o.expectedAmount, year, month), 0);
      groceryForecast = groceryMonthlyForecast;
    }

    const overrideIncome = monthOverrides
      .filter(o => o.type === 'income')
      .reduce((s, o) => s + Number(o.amount), 0);
    const overrideExpense = monthOverrides
      .filter(o => o.type === 'expense')
      .reduce((s, o) => s + Number(o.amount), 0);

    const totalIncome = income + overrideIncome;
    const totalOutgoings = billsTotal + groceryForecast + overrideExpense;
    const net = totalIncome - totalOutgoings;
    runningSurplus += net;

    monthData.push({
      month,
      year,
      isPast: isPast || isCurrent,
      isEstimated,
      income,
      bills: billsTotal,
      groceryForecast,
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

  // Tracked income from actual transactions (excluding salary-level ones already in salary row)
  yearTransactions.forEach(t => {
    if (t.type !== 'income' || !isTrackedIncome(t.description)) return;
    const monthIdx = parseInt(t.transaction_date.substring(5, 7), 10) - 1;
    const source = getTrackedIncomeLabel(t.description || 'Other Income');
    if (!incomeBreakdown[source]) incomeBreakdown[source] = new Array(12).fill(0);
    incomeBreakdown[source][monthIdx] += Math.abs(Number(t.amount));
  });

  // Add salary row - actual from transactions for past, estimated for future
  if (estimatedSalary > 0) {
    const salaryLabel = `${salaryEmployer} (Salary)`;
    if (!incomeBreakdown[salaryLabel]) incomeBreakdown[salaryLabel] = new Array(12).fill(0);

    // For past months, check if salary transaction exists
    for (let month = 0; month < 12; month++) {
      const isPast = year < currentYear || (year === currentYear && month < currentMonth);
      const isCurrent = year === currentYear && month === currentMonth;
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (isPast) {
        // Use actual salary-level income transactions for past months
        const salaryTxns = yearTransactions.filter(t =>
          t.transaction_date.startsWith(monthStr) &&
          t.type === 'income' &&
          !isTrackedIncome(t.description) &&
          Math.abs(Number(t.amount)) > 500
        );
        salaryTxns.forEach(t => {
          incomeBreakdown[salaryLabel][month] += Math.abs(Number(t.amount));
        });
      } else if (isCurrent) {
        // Check if salary arrived this month already
        const hasSalary = yearTransactions.some(t =>
          t.transaction_date.startsWith(monthStr) &&
          t.type === 'income' &&
          !isTrackedIncome(t.description) &&
          Math.abs(Number(t.amount)) > 500
        );
        if (hasSalary) {
          const salaryTxns = yearTransactions.filter(t =>
            t.transaction_date.startsWith(monthStr) &&
            t.type === 'income' &&
            !isTrackedIncome(t.description) &&
            Math.abs(Number(t.amount)) > 500
          );
          salaryTxns.forEach(t => {
            incomeBreakdown[salaryLabel][month] += Math.abs(Number(t.amount));
          });
        } else {
          incomeBreakdown[salaryLabel][month] = estimatedSalary;
        }
      } else {
        // Future months: use estimated salary
        incomeBreakdown[salaryLabel][month] = estimatedSalary;
      }
    }

    // Also add estimated tracked income for future months
    for (let month = 0; month < 12; month++) {
      const isPast = year < currentYear || (year === currentYear && month <= currentMonth);
      if (!isPast && averageTrackedIncome > 0) {
        // Distribute average tracked income across known sources
        const sources = Object.keys(incomeBreakdown).filter(s => s !== salaryLabel);
        if (sources.length > 0) {
          const perSource = averageTrackedIncome / sources.length;
          sources.forEach(source => {
            if (incomeBreakdown[source][month] === 0) {
              incomeBreakdown[source][month] = perSource;
            }
          });
        }
      }
    }
  }

  return {
    monthData,
    overrides,
    incomeBreakdown,
    createOverride: createOverride.mutate,
    deleteOverride: deleteOverride.mutate,
    isCreating: createOverride.isPending,
  };
}
