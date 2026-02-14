import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { getBillOccurrencesForMonth } from "@/lib/billOccurrences";
import type { Bill } from "@/hooks/useBills";
import type { BankAccount } from "@/hooks/useAccounts";
import { useMemo } from "react";

const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface MonthAccountBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: number; // 0-11
  year: number;
  bills: Bill[];
  accounts: BankAccount[];
  getOverride?: (rowKey: string, month: number) => number | undefined;
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface AccountGroup {
  accountName: string;
  items: { name: string; amount: number }[];
  total: number;
}

export function MonthAccountBreakdownDialog({
  open,
  onOpenChange,
  month,
  year,
  bills,
  accounts,
  getOverride,
}: MonthAccountBreakdownDialogProps) {
  const accountMap = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach(a => m.set(a.id, a.display_name || a.name));
    return m;
  }, [accounts]);

  const groups = useMemo(() => {
    const activeBills = bills.filter(b => b.is_active);
    const grouped = new Map<string, AccountGroup>();

    activeBills.forEach(bill => {
      const occs = getBillOccurrencesForMonth([bill], year, month);
      let amount = occs.reduce((s, o) => s + o.expectedAmount, 0);
      if (amount <= 0) return;

      // Check for cell override
      const ovr = getOverride?.(`bill:${bill.id}`, month);
      if (ovr !== undefined) amount = ovr;

      const accountId = bill.account_id || "unassigned";
      const accountName = bill.account_id
        ? accountMap.get(bill.account_id) || "Unknown Account"
        : "Unassigned";

      if (!grouped.has(accountId)) {
        grouped.set(accountId, { accountName, items: [], total: 0 });
      }
      const group = grouped.get(accountId)!;
      group.items.push({ name: bill.name, amount });
      group.total += amount;
    });

    // Sort: assigned accounts first (alphabetically), unassigned last
    const sorted = Array.from(grouped.values()).sort((a, b) => {
      if (a.accountName === "Unassigned") return 1;
      if (b.accountName === "Unassigned") return -1;
      return a.accountName.localeCompare(b.accountName);
    });

    return sorted;
  }, [bills, year, month, accountMap, getOverride]);

  const grandTotal = groups.reduce((s, g) => s + g.total, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {MONTH_FULL[month]} {year} — Account Breakdown
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No outgoings for this month.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.accountName}>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {group.accountName === "Unassigned" ? (
                    <span className="text-warning">{group.accountName}</span>
                  ) : (
                    group.accountName
                  )}
                </h3>
                <div className="space-y-1 pl-2">
                  {group.items
                    .sort((a, b) => b.amount - a.amount)
                    .map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-muted-foreground truncate mr-2">
                          {item.name}
                        </span>
                        <span className="font-medium tabular-nums whitespace-nowrap">
                          {fmt(item.amount)}
                        </span>
                      </div>
                    ))}
                </div>
                <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/50">
                  <span className="text-xs font-semibold text-muted-foreground">
                    Total
                  </span>
                  <span className="text-sm font-bold tabular-nums">
                    {fmt(group.total)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {groups.length > 0 && (
          <>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">Grand Total</span>
              <span className="text-base font-bold tabular-nums">
                {fmt(grandTotal)}
              </span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
