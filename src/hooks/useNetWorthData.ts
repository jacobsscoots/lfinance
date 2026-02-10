import { useMemo } from "react";
import { useAccounts } from "./useAccounts";
import { useInvestments } from "./useInvestments";
import { useInvestmentValuations } from "./useInvestmentValuations";
import { useDebts } from "./useDebts";

export interface NetWorthBreakdown {
  bankTotal: number;
  investmentTotal: number;
  debtTotal: number;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  bankAccounts: Array<{ name: string; balance: number; type: string }>;
  investmentAccounts: Array<{ name: string; value: number; provider: string | null }>;
  debtAccounts: Array<{ name: string; balance: number; type: string }>;
}

export function useNetWorthData(): { data: NetWorthBreakdown; isLoading: boolean } {
  const { visibleAccounts, isLoading: accountsLoading } = useAccounts();
  const { investments, isLoading: investmentsLoading } = useInvestments();
  const { valuations, isLoading: valuationsLoading } = useInvestmentValuations();
  const { debts, isLoading: debtsLoading } = useDebts();

  const data = useMemo<NetWorthBreakdown>(() => {
    // Bank accounts
    const bankAccounts = (visibleAccounts ?? []).map((a) => ({
      name: a.display_name || a.name,
      balance: Number(a.balance),
      type: a.account_type || "current",
    }));
    const bankTotal = bankAccounts.reduce((s, a) => s + a.balance, 0);

    // Investments — use latest valuation per account
    const latestValByAccount = new Map<string, number>();
    for (const v of valuations) {
      if (!latestValByAccount.has(v.investment_account_id)) {
        latestValByAccount.set(v.investment_account_id, v.value);
      }
    }
    const investmentAccounts = (investments ?? []).map((inv) => ({
      name: inv.name,
      value: latestValByAccount.get(inv.id) ?? 0,
      provider: inv.provider,
    }));
    const investmentTotal = investmentAccounts.reduce((s, a) => s + a.value, 0);

    // Debts (only open)
    const openDebts = (debts ?? []).filter((d) => d.status === "open");
    const debtAccounts = openDebts.map((d) => ({
      name: d.creditor_name,
      balance: Number(d.current_balance),
      type: d.debt_type,
    }));
    const debtTotal = debtAccounts.reduce((s, a) => s + a.balance, 0);

    const totalAssets = bankTotal + investmentTotal;
    const totalLiabilities = debtTotal;

    return {
      bankTotal,
      investmentTotal,
      debtTotal,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      bankAccounts,
      investmentAccounts,
      debtAccounts,
    };
  }, [visibleAccounts, investments, valuations, debts]);

  return {
    data,
    isLoading: accountsLoading || investmentsLoading || valuationsLoading || debtsLoading,
  };
}