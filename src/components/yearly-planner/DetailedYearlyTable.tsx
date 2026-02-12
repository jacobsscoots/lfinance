import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getBillOccurrencesForMonth } from "@/lib/billOccurrences";
import type { Bill } from "@/hooks/useBills";
import type { MonthData, YearlyOverride } from "@/hooks/useYearlyPlannerData";

const MONTH_NAMES = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
const MONTH_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const FREQ_LABELS: Record<string, string> = {
  weekly: "Wk",
  biweekly: "2wk",
  "4weekly": "4wk",
  monthly: "Mo",
  bimonthly: "2mo",
  quarterly: "3mo",
  biannual: "6mo",
  annual: "Yr",
  daily: "Day",
};

interface DetailedYearlyTableProps {
  months: MonthData[];
  bills: Bill[];
  year: number;
  onAddOverride: (month: number) => void;
  onDeleteOverride: (id: string) => void;
  incomeBreakdown?: Record<string, number[]>;
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
  frequency: string;
  amounts: number[]; // 12 months
  total: number;
  priority: number;
}

export function DetailedYearlyTable({ months, bills, year, onAddOverride, onDeleteOverride, incomeBreakdown = {} }: DetailedYearlyTableProps) {
  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills]);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);

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

  // April 2026 inflation adjustments (must match useYearlyPlannerData.ts)
  const APRIL_2026_INFLATION: Record<string, { type: 'percent' | 'flat' | 'fixed'; value: number }> = {
    'Council Tax':           { type: 'percent', value: 5 },
    'TV License':            { type: 'fixed',   value: 180 },
    'TV Licence':            { type: 'fixed',   value: 180 },
    'EE Phone Payment':      { type: 'flat',    value: 2.50 },
    'Santander Premium Bank': { type: 'percent', value: 25 },
  };

  const applyInflation = (billName: string, baseAmount: number, yr: number, mo: number): number => {
    if (yr < 2026 || (yr === 2026 && mo < 3)) return baseAmount; // April = month index 3
    if (baseAmount === 0) return 0;
    const rule = APRIL_2026_INFLATION[billName];
    if (!rule) return baseAmount;
    if (rule.type === 'percent') return Math.round(baseAmount * (1 + rule.value / 100) * 100) / 100;
    if (rule.type === 'flat') return baseAmount + rule.value;
    if (rule.type === 'fixed') return rule.value;
    return baseAmount;
  };

  // Build per-bill, per-month amounts
  const billRows: BillRow[] = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return activeBills.map(bill => {
      const amounts: number[] = [];
      for (let month = 0; month < 12; month++) {
        const isPast = year < currentYear || (year === currentYear && month < currentMonth);
        const isCurrent = year === currentYear && month === currentMonth;
        const occs = getBillOccurrencesForMonth([bill], year, month);
        let monthTotal = occs.reduce((s, o) => s + o.expectedAmount, 0);
        // Apply inflation for future months only
        if (!isPast && !isCurrent && monthTotal > 0) {
          monthTotal = applyInflation(bill.name, monthTotal, year, month);
        }
        amounts.push(monthTotal);
      }
      return {
        id: bill.id,
        name: bill.name,
        frequency: bill.frequency,
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

  // Check if any months have inflation applied
  const hasInflation = year >= 2026;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          {hasInflation && (
             <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded">
               📈 Apr 2026+: Council Tax +5%, TV Licence →£180, EE +£2.50/mo, Santander +25% | Salary +3.4% | Broadband & Electric protected by contract
             </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(labelClass, "bg-card")}>Category</th>
              {months.map((m) => (
                <th key={m.month} className={cn(headerClass, m.isPast && "text-muted-foreground")}>
                  {MONTH_FULL[m.month].substring(0, 3)}
                  {m.isPast ? (
                    <span className="block text-[9px] text-muted-foreground">Actual</span>
                  ) : m.isEstimated ? (
                    <span className="block text-[9px] text-primary/70">Est.</span>
                  ) : null}
                </th>
              ))}
              <th className={cn(headerClass, "bg-muted/50")}>Total</th>
            </tr>
          </thead>
          <tbody>
            {/* INCOME ROW */}
            <tr className="border-b border-border bg-success/5">
              <td className={cn(labelClass, "text-success bg-success/5")}>
                <span className="flex items-center gap-1.5">
                  Income
                  <button
                    onClick={() => setShowIncomeBreakdown(!showIncomeBreakdown)}
                    className="text-muted-foreground hover:text-success transition-colors"
                    title={showIncomeBreakdown ? "Hide income breakdown" : "Show income breakdown"}
                  >
                    {showIncomeBreakdown ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </span>
              </td>
              {months.map((m) => (
                <td key={m.month} className={cn(cellClass, "text-success font-medium")}>
                  {m.totalIncome > 0 ? fmt(m.totalIncome) : "—"}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold text-success bg-muted/50")}>
                {fmt(months.reduce((s, m) => s + m.totalIncome, 0))}
              </td>
            </tr>

            {/* INCOME BREAKDOWN ROWS */}
            {showIncomeBreakdown && Object.entries(incomeBreakdown).map(([source, amounts]) => (
              <tr key={source} className="border-b border-border/30 bg-success/3">
                <td className={cn(labelClass, "font-normal text-success/80 pl-6 bg-success/3 text-[11px]")}>
                  {source}
                </td>
                {amounts.map((amt, i) => (
                  <td key={i} className={cn(cellClass, "text-[11px]", amt > 0 ? "text-success/70" : "text-muted-foreground/30")}>
                    {amt > 0 ? fmt(amt) : "—"}
                  </td>
                ))}
                <td className={cn(cellClass, "text-[11px] font-medium bg-muted/50 text-success/70")}>
                  {fmt(amounts.reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            ))}

            {/* SECTION: OUTGOINGS */}
            <tr className="border-b border-border">
              <td colSpan={14} className="px-2 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground bg-muted/30">
                Outgoings
              </td>
            </tr>

            {/* Individual bill rows + Groceries inserted after utilities */}
            {(() => {
              const groceryPriority = 2.5; // After utilities (2), before phone (4)
              const hasGrocery = months.some(m => m.groceryForecast > 0);
              let groceryInserted = false;

              const rows: React.ReactNode[] = [];
              billRows.forEach((row) => {
                // Insert groceries before the first bill with priority > groceryPriority
                if (hasGrocery && !groceryInserted && row.priority > groceryPriority) {
                  groceryInserted = true;
                  rows.push(
                    <tr key="grocery-forecast" className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className={cn(labelClass, "font-normal")}>
                        <span className="flex items-center gap-1.5">
                          🛒 Groceries
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-primary/70">
                            Est.
                          </Badge>
                        </span>
                      </td>
                      {months.map((m, i) => (
                        <td key={i} className={cn(cellClass, m.groceryForecast > 0 ? "text-primary/80 italic" : "text-muted-foreground/40")}>
                          {m.groceryForecast > 0 ? fmt(m.groceryForecast) : "—"}
                        </td>
                      ))}
                      <td className={cn(cellClass, "font-semibold bg-muted/50 text-primary/80 italic")}>
                        {fmt(months.reduce((s, m) => s + m.groceryForecast, 0))}
                      </td>
                    </tr>
                  );
                }

                rows.push(
                  <tr key={row.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className={cn(labelClass, "font-normal")}>
                      <span className="flex items-center gap-1.5">
                        {row.name}
                        {row.frequency && row.frequency !== "monthly" && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-muted-foreground">
                            {FREQ_LABELS[row.frequency] || row.frequency}
                          </Badge>
                        )}
                      </span>
                    </td>
                    {row.amounts.map((amt, i) => (
                      <td key={i} className={cn(cellClass, amt > 0 ? "text-foreground" : "text-muted-foreground/40")}>
                        {amt > 0 ? fmt(amt) : "—"}
                      </td>
                    ))}
                    <td className={cn(cellClass, "font-semibold bg-muted/50")}>
                      {row.total > 0 ? fmt(row.total) : "—"}
                    </td>
                  </tr>
                );
              });

              // If all bills have priority <= groceryPriority, append at end
              if (hasGrocery && !groceryInserted) {
                rows.push(
                  <tr key="grocery-forecast" className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className={cn(labelClass, "font-normal")}>
                      <span className="flex items-center gap-1.5">
                        🛒 Groceries
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-primary/70">Est.</Badge>
                      </span>
                    </td>
                    {months.map((m, i) => (
                      <td key={i} className={cn(cellClass, m.groceryForecast > 0 ? "text-primary/80 italic" : "text-muted-foreground/40")}>
                        {m.groceryForecast > 0 ? fmt(m.groceryForecast) : "—"}
                      </td>
                    ))}
                    <td className={cn(cellClass, "font-semibold bg-muted/50 text-primary/80 italic")}>
                      {fmt(months.reduce((s, m) => s + m.groceryForecast, 0))}
                    </td>
                  </tr>
                );
              }

              return rows;
            })()}

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
