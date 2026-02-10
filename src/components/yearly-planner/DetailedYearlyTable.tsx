import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBillOccurrencesForMonth } from "@/lib/billOccurrences";
import type { Bill } from "@/hooks/useBills";
import type { MonthData, YearlyOverride } from "@/hooks/useYearlyPlannerData";

const MONTH_NAMES = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

interface DetailedYearlyTableProps {
  months: MonthData[];
  bills: Bill[];
  year: number;
  onAddOverride: (month: number) => void;
  onDeleteOverride: (id: string) => void;
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

interface BillRow {
  id: string;
  name: string;
  amounts: number[]; // 12 months
  total: number;
  priority: number;
}

export function DetailedYearlyTable({ months, bills, year, onAddOverride, onDeleteOverride }: DetailedYearlyTableProps) {
  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills]);

  // Priority keywords for bill sorting (lower number = higher priority)
  const getBillPriority = (name: string): number => {
    const n = name.toLowerCase();
    if (/rent|mortgage/.test(n)) return 0;
    if (/council\s*tax/.test(n)) return 1;
    if (/electric|gas|energy|water|sewage/.test(n)) return 2;
    if (/broadband|internet|wifi|fibre/.test(n)) return 3;
    if (/phone|mobile|sim/.test(n)) return 4;
    if (/insurance/.test(n)) return 5;
    if (/car|petrol|fuel|transport|train/.test(n)) return 6;
    if (/tv\s*licen|netflix|disney|spotify|apple|amazon\s*prime|youtube/.test(n)) return 8;
    if (/gym|subscription|membership/.test(n)) return 9;
    return 7; // Everything else between utilities and subscriptions
  };

  // Build per-bill, per-month amounts
  const billRows: BillRow[] = useMemo(() => {
    return activeBills.map(bill => {
      const amounts: number[] = [];
      for (let month = 0; month < 12; month++) {
        const occs = getBillOccurrencesForMonth([bill], year, month);
        amounts.push(occs.reduce((s, o) => s + o.expectedAmount, 0));
      }
      return {
        id: bill.id,
        name: bill.name,
        amounts,
        total: amounts.reduce((s, v) => s + v, 0),
        priority: getBillPriority(bill.name),
      };
    })
    .filter(row => row.total > 0)
    .sort((a, b) => a.priority - b.priority || b.total - a.total);
  }, [activeBills, year]);

  // Override rows grouped by month
  const overrideRows = useMemo(() => {
    const allOverrides: YearlyOverride[] = months.flatMap(m => m.overrides);
    // Group unique overrides by label
    const labels = [...new Set(allOverrides.map(o => o.label))];
    return labels.map(label => {
      const amounts: number[] = [];
      const overrideIds: (string | null)[] = [];
      for (let month = 0; month < 12; month++) {
        const override = allOverrides.find(o => o.month === month + 1 && o.label === label);
        amounts.push(override ? Number(override.amount) : 0);
        overrideIds.push(override?.id ?? null);
      }
      const firstOverride = allOverrides.find(o => o.label === label);
      return {
        label,
        type: firstOverride?.type ?? 'expense',
        amounts,
        overrideIds,
        total: amounts.reduce((s, v) => s + v, 0),
      };
    });
  }, [months]);

  const cellClass = "px-2 py-1.5 text-right text-xs whitespace-nowrap";
  const labelClass = "px-2 py-1.5 text-xs font-medium whitespace-nowrap sticky left-0 bg-card z-10";
  const headerClass = "px-2 py-2 text-center text-xs font-semibold whitespace-nowrap";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Detailed Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(labelClass, "bg-card")}>Category</th>
              {months.map((m) => (
                <th key={m.month} className={cn(headerClass, m.isPast && "text-muted-foreground")}>
                  {MONTH_FULL[m.month].substring(0, 3)}
                  {m.isPast && <span className="block text-[9px] text-muted-foreground">Actual</span>}
                </th>
              ))}
              <th className={cn(headerClass, "bg-muted/50")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* INCOME ROW */}
            <tr className="border-b border-border bg-success/5">
              <td className={cn(labelClass, "text-success bg-success/5")}>Income</td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass, "text-success font-medium")}>
                  {m.totalIncome > 0 ? fmt(m.totalIncome) : "—"}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold text-success bg-muted/50")}>
                {fmt(months.reduce((s, m) => s + m.totalIncome, 0))}
              </td>
            </tr>

            {/* SECTION: OUTGOINGS */}
            <tr className="border-b border-border">
              <td colSpan={14} className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground bg-muted/30">
                Outgoings
              </td>
            </tr>

            {/* Individual bill rows */}
            {billRows.map((row) => (
              <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className={cn(labelClass, "font-normal")}>{row.name}</td>
                {row.amounts.map((amt, i) => (
                  <td key={i} className={cn(cellClass, amt > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                    {amt > 0 ? fmt(amt) : "—"}
                  </td>
                ))}
                <td className={cn(cellClass, "font-semibold bg-muted/50")}>
                  {row.total > 0 ? fmt(row.total) : "—"}
                </td>
              </tr>
            ))}

            {/* Discretionary spending row */}
            <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
              <td className={cn(labelClass, "font-normal")}>Discretionary</td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass)}>
                  {m.discretionary > 0 ? fmt(m.discretionary) : "—"}
                </td>
              ))}
              <td className={cn(cellClass, "font-semibold bg-muted/50")}>
                {fmt(months.reduce((s, m) => s + m.discretionary, 0))}
              </td>
            </tr>

            {/* Override adjustments */}
            {overrideRows.filter(o => o.type === 'expense').map((row) => (
              <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className={cn(labelClass, "font-normal text-warning")}>
                  {row.label}
                </td>
                {row.amounts.map((amt, i) => (
                  <td key={i} className={cn(cellClass, amt > 0 ? "text-warning" : "text-muted-foreground/40")}>
                    {amt > 0 ? fmt(amt) : "—"}
                  </td>
                ))}
                <td className={cn(cellClass, "font-semibold bg-muted/50 text-warning")}>
                  {row.total > 0 ? fmt(row.total) : "—"}
                </td>
              </tr>
            ))}

            {/* Income overrides */}
            {overrideRows.filter(o => o.type === 'income').map((row) => (
              <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className={cn(labelClass, "font-normal text-success")}>
                  + {row.label}
                </td>
                {row.amounts.map((amt, i) => (
                  <td key={i} className={cn(cellClass, amt > 0 ? "text-success" : "text-muted-foreground/40")}>
                    {amt > 0 ? `+${fmt(amt)}` : "—"}
                  </td>
                ))}
                <td className={cn(cellClass, "font-semibold bg-muted/50 text-success")}>
                  {row.total > 0 ? `+${fmt(row.total)}` : "—"}
                </td>
              </tr>
            ))}

            {/* SUBTOTAL */}
            <tr className="border-b-2 border-border font-bold bg-muted/30">
              <td className={cn(labelClass, "font-bold bg-muted/30")}>Total Outgoings</td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-bold")}>
                  {fmt(m.totalOutgoings)}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50")}>
                {fmt(months.reduce((s, m) => s + m.totalOutgoings, 0))}
              </td>
            </tr>

            {/* EMPTY ROW SPACER */}
            <tr><td colSpan={14} className="h-2" /></tr>

            {/* NET */}
            <tr className="border-b border-border">
              <td className={cn(labelClass, "font-bold")}>Net</td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-bold", m.net >= 0 ? "text-success" : "text-destructive")}>
                  {m.net >= 0 ? "+" : "-"}{fmtShort(m.net)}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50", months.reduce((s, m) => s + m.net, 0) >= 0 ? "text-success" : "text-destructive")}>
                {(() => { const n = months.reduce((s, m) => s + m.net, 0); return `${n >= 0 ? "+" : "-"}${fmtShort(n)}`; })()}
              </td>
            </tr>

            {/* LEFT OVER / SAVINGS */}
            <tr className="border-b border-border">
              <td className={cn(labelClass, "font-bold")}>Left Over</td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-medium", m.net >= 0 ? "text-success" : "text-destructive")}>
                  {m.net >= 0 ? fmt(m.net) : `-${fmt(m.net)}`}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50")}>
                {fmt(months.reduce((s, m) => s + Math.max(0, m.net), 0))}
              </td>
            </tr>

            {/* RUNNING SURPLUS */}
            <tr className="border-b-2 border-border">
              <td className={cn(labelClass, "font-bold")}>Running Surplus</td>
              {months.map((m) => (
                <td key={m.month} className={cn(
                  cellClass, "font-bold",
                  m.runningSurplus < 0 ? "text-destructive bg-destructive/10" :
                  m.runningSurplus < 100 ? "text-warning bg-warning/10" :
                  "text-success bg-success/10"
                )}>
                  {m.runningSurplus >= 0 ? "+" : "-"}{fmtShort(m.runningSurplus)}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50")}>
                {(() => { const last = months[months.length - 1]; return last ? `${last.runningSurplus >= 0 ? "+" : "-"}${fmtShort(last.runningSurplus)}` : "—"; })()}
              </td>
            </tr>

            {/* ADJUST BUTTONS ROW */}
            <tr>
              <td className={cn(labelClass, "bg-card")} />
              {months.map((m) => (
                <td key={m.month} className="px-1 py-1 text-center">
                  {!m.isPast && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => onAddOverride(m.month + 1)}
                    >
                      <Plus className="h-3 w-3 mr-0.5" />
                      Adj
                    </Button>
                  )}
                </td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
