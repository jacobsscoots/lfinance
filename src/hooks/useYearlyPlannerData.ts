import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { useGroceryForecast } from "@/hooks/useGroceryForecast";
import { useBirthdayEvents } from "@/hooks/useBirthdayEvents";
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
  birthdayOutgoings: number;
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
  const { events: birthdayEvents } = useBirthdayEvents();
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
  const baseSalary = payslips.length > 0 && payslips[0].net_pay
    ? Number(payslips[0].net_pay)
    : 0;
  const salaryEmployer = payslips.length > 0 ? payslips[0].employer_name || "Salary" : "Salary";

  // Thames Water confirmed 3.4% pay increase from April 2026
  const SALARY_INCREASE_APRIL_2026 = 0.034;

  const getEstimatedSalary = (yr: number, mo: number): number => {
    if (yr > 2026 || (yr === 2026 && mo >= 3)) {
      return Math.round(baseSalary * (1 + SALARY_INCREASE_APRIL_2026) * 100) / 100;
    }
    return baseSalary;
  };

  // Build month data
  const monthData: MonthData[] = [];
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const averageTrackedIncome = getMonthlyTrackedIncome();
  const activeBills = bills.filter(b => b.is_active);

  // ─── APRIL 2026 – MARCH 2027 BILL ADJUSTMENTS ───
  // Researched from official/reputable sources. Update this config as new
  // announcements are made for the 2026/27 tax year.
  // Last reviewed: Feb 2026
  const APRIL_2026_INFLATION: Record<string, { type: 'percent' | 'flat' | 'fixed'; value: number; source: string }> = {
    // --- Confirmed increases ---
    'Council Tax':           { type: 'percent', value: 5,     source: 'Swindon BC +5% for 2026/27 (Band B, single person 25% discount, 10 instalments Apr-Jan)' },
    'TV License':            { type: 'fixed',   value: 180,   source: 'BBC/Gov confirmed £180/yr from Apr 2026' },
    'TV Licence':            { type: 'fixed',   value: 180,   source: 'BBC/Gov confirmed £180/yr from Apr 2026' },
    'EE Phone Payment':      { type: 'flat',    value: 2.50,  source: 'EE confirmed +£2.50/mo from Apr 2026 (Bristol Live/Uswitch)' },
    'Santander Premium Bank': { type: 'percent', value: 25,   source: 'Santander 25% fee hike on premium accounts (The Sun, Jan 2026)' },
    // --- No change confirmed (frozen / contract-protected / no announcement) ---
    // 'Broadband' — Fibrely, in fixed-term contract
    // 'Electric' — in fixed-term contract, no gov subsidy applies (Warm Home Discount is means-tested)
    // 'Spotify' — UK already at £12.99 since Nov 2024, no Apr 2026 UK increase
    // 'iCloud+' — no UK increase announced for 2026
    // '1p Mobile' — no mid-contract price rises policy
    // 'Monzo Premium Bank' — no increase announced
    // 'NHS Prepaid Prescriptions' — frozen for 2026/27 (Gov confirmed)
    // 'Gym' — no increase announced
    // 'Rent' — not specified as changing
  };

  // Council Tax is paid over 10 monthly instalments (April–January).
  // February (index 1) and March (index 2) are payment holidays.
  const COUNCIL_TAX_PAYMENT_MONTHS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // Jan, Apr-Nov, Dec

  const isCouncilTaxMonth = (mo: number): boolean =>
    COUNCIL_TAX_PAYMENT_MONTHS.includes(mo);

  const getInflationAdjustedAmount = (billName: string, baseAmount: number, yr: number, mo: number): number => {
    // Council Tax: skip Feb (1) and Mar (2) — no instalments
    if (/council\s*tax/i.test(billName) && !isCouncilTaxMonth(mo)) return 0;

    // Only apply inflation from April 2026 onwards
    if (yr < 2026 || (yr === 2026 && mo < 3)) return baseAmount;
    if (baseAmount === 0) return 0;
    const rule = APRIL_2026_INFLATION[billName];
    if (!rule) return baseAmount;
    if (rule.type === 'percent') return Math.round(baseAmount * (1 + rule.value / 100) * 100) / 100;
    if (rule.type === 'flat') return baseAmount + rule.value;
    if (rule.type === 'fixed') return rule.value;
    return baseAmount;
  };

  let runningSurplus = 0;

  for (let month = 0; month < 12; month++) {
    const isPast = year < currentYear || (year === currentYear && month < currentMonth);
    const isCurrent = year === currentYear && month === currentMonth;
    const isEstimated = !isPast && !isCurrent;
    const monthOverrides = overrides.filter(o => o.month === month + 1);
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    // ─── INCOME ───
    // Always include salary: use actual transaction if found, otherwise estimated
    let income = 0;
    const salaryTxns = yearTransactions.filter(t =>
      t.transaction_date.startsWith(monthStr) &&
      t.type === 'income' &&
      !isTrackedIncome(t.description) &&
      Math.abs(Number(t.amount)) > 500
    );
    if (salaryTxns.length > 0) {
      income += salaryTxns.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    } else if (baseSalary > 0) {
      income += getEstimatedSalary(year, month);
    }

    // Tracked income: use actual if available for past/current, average for future
    if (isPast || isCurrent) {
      yearTransactions.forEach(t => {
        if (t.transaction_date.startsWith(monthStr) && t.type === 'income' && isTrackedIncome(t.description)) {
          income += Math.abs(Number(t.amount));
        }
      });
    } else {
      income += averageTrackedIncome;
    }

    // ─── OUTGOINGS ───
    // Always use projected bills from occurrence engine (matches table's bill rows)
    const occurrences = getBillOccurrencesForMonth(activeBills, year, month);
    let billsTotal = occurrences.reduce((s, o) => s + getInflationAdjustedAmount(o.billName, o.expectedAmount, year, month), 0);
    let groceryForecast = groceryMonthlyForecast;
    let discretionary = 0;

    // Birthday outgoings: sum budgets for events in this month (month is 0-indexed, event_month is 1-indexed)
    const birthdayOutgoings = birthdayEvents
      .filter(e => e.is_active !== false && e.event_month === month + 1 && Number(e.budget) > 0)
      .reduce((s, e) => s + Number(e.budget), 0);

    const overrideIncome = monthOverrides
      .filter(o => o.type === 'income')
      .reduce((s, o) => s + Number(o.amount), 0);
    const overrideExpense = monthOverrides
      .filter(o => o.type === 'expense')
      .reduce((s, o) => s + Number(o.amount), 0);

    const totalIncome = income + overrideIncome;
    const totalOutgoings = billsTotal + discretionary + groceryForecast + overrideExpense + birthdayOutgoings;
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
      birthdayOutgoings,
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
  if (baseSalary > 0) {
    const salaryLabel = `${salaryEmployer} (Salary)`;
    if (!incomeBreakdown[salaryLabel]) incomeBreakdown[salaryLabel] = new Array(12).fill(0);

    // For past months, check if salary transaction exists
    for (let month = 0; month < 12; month++) {
      const isPast = year < currentYear || (year === currentYear && month < currentMonth);
      const isCurrent = year === currentYear && month === currentMonth;
      const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

      if (isPast || isCurrent) {
        // Use actual salary-level income transactions, fall back to estimated
        const salaryTxns = yearTransactions.filter(t =>
          t.transaction_date.startsWith(monthStr) &&
          t.type === 'income' &&
          !isTrackedIncome(t.description) &&
          Math.abs(Number(t.amount)) > 500
        );
        if (salaryTxns.length > 0) {
          salaryTxns.forEach(t => {
            incomeBreakdown[salaryLabel][month] += Math.abs(Number(t.amount));
          });
        } else {
          incomeBreakdown[salaryLabel][month] = getEstimatedSalary(year, month);
        }
      } else {
        // Future months: use estimated salary
        incomeBreakdown[salaryLabel][month] = getEstimatedSalary(year, month);
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
