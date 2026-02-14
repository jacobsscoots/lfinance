import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Eye, EyeOff, Undo2 } from "lucide-react";
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
  getOverride?: (rowKey: string, month: number) => number | undefined;
  hasOverride?: (rowKey: string, month: number) => boolean;
  onCellEdit?: (rowKey: string, month: number, amount: number) => void;
  onCellReset?: (rowKey: string, month: number) => void;
  onMonthHeaderClick?: (month: number) => void;
  /** Pass the raw override map so useMemo can depend on its identity for recalculation */
  overrideMap?: Map<string, number>;
}

function fmt(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtShort(n: number) {
  return `£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Editable Cell ──
interface EditableCellProps {
  value: number;
  overrideValue?: number;
  hasOverride: boolean;
  className?: string;
  displayFn?: (n: number) => string;
  prefix?: string;
  onSave: (amount: number) => void;
  onReset: () => void;
  isEditable?: boolean;
}

function EditableCell({
  value,
  overrideValue,
  hasOverride,
  className,
  displayFn = fmt,
  prefix = "",
  onSave,
  onReset,
  isEditable = true,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const editStartRef = useRef(0);

  const displayAmount = hasOverride ? overrideValue! : value;

  const startEdit = () => {
    if (!isEditable) return;
    editStartRef.current = Date.now();
    setEditValue(displayAmount > 0 ? displayAmount.toFixed(2) : "");
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 50);
  };

  const commitEdit = useCallback(() => {
    if (!editing) return;
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed) && parsed >= 0) {
      onSave(Math.round(parsed * 100) / 100);
    }
    setEditing(false);
  }, [editing, editValue, onSave]);

  const handleBlur = () => {
    if (Date.now() - editStartRef.current < 200) return;
    commitEdit();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { setEditing(false); }
  };

  if (editing) {
    return (
      <td className={cn(className, "!p-0.5")}>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="0.01"
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-6 text-[11px] sm:text-xs text-right px-1 bg-background border border-primary/50 rounded outline-none focus:ring-1 focus:ring-primary tabular-nums"
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        className,
        isEditable && "cursor-pointer hover:bg-primary/5 transition-colors",
        hasOverride && "bg-primary/10 border-b-2 border-primary/30"
      )}
      onClick={startEdit}
      onContextMenu={(e) => {
        if (hasOverride) {
          e.preventDefault();
          onReset();
        }
      }}
      title={hasOverride ? "Overridden — right-click to reset" : isEditable ? "Click to edit" : ""}
    >
      {prefix}{displayAmount > 0 ? displayFn(displayAmount) : "—"}
      {hasOverride && <span className="text-[8px] text-primary ml-0.5">✎</span>}
    </td>
  );
}

interface BillRow {
  id: string;
  name: string;
  frequency: string;
  amounts: number[]; // 12 months
  total: number;
  priority: number;
}

export function DetailedYearlyTable({
  months,
  bills,
  year,
  onAddOverride,
  onDeleteOverride,
  incomeBreakdown = {},
  getOverride,
  hasOverride: hasOverrideFn,
  onCellEdit,
  onCellReset,
  onMonthHeaderClick,
  overrideMap: overrideMapProp,
}: DetailedYearlyTableProps) {
  const activeBills = useMemo(() => bills.filter(b => b.is_active), [bills]);
  const [showIncomeBreakdown, setShowIncomeBreakdown] = useState(false);
  const canEdit = !!onCellEdit;

  // Use a ref so the useMemo always reads the latest override function
  const getOverrideRef = useRef(getOverride);
  const hasOverrideRef = useRef(hasOverrideFn);
  useEffect(() => {
    getOverrideRef.current = getOverride;
    hasOverrideRef.current = hasOverrideFn;
  }, [getOverride, hasOverrideFn]);

  const getOvr = (key: string, month: number) => getOverrideRef.current?.(key, month);
  const hasOvr = (key: string, month: number) => hasOverrideRef.current?.(key, month) ?? false;
  const saveCell = (key: string, month: number, amt: number) => onCellEdit?.(key, month, amt);
  const resetCell = (key: string, month: number) => onCellReset?.(key, month);

  // Helper to get effective amount for a cell (override or original)
  const effective = (key: string, month: number, original: number): number => {
    const ovr = getOverrideRef.current?.(key, month);
    return ovr !== undefined ? ovr : original;
  };

  // Priority keywords for bill sorting
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
    return 7;
  };

  // April 2026 inflation adjustments
  const APRIL_2026_INFLATION: Record<string, { type: 'percent' | 'flat' | 'fixed'; value: number }> = {
    'Council Tax':           { type: 'percent', value: 5 },
    'TV License':            { type: 'fixed',   value: 180 },
    'TV Licence':            { type: 'fixed',   value: 180 },
    'EE Phone Payment':      { type: 'flat',    value: 2.50 },
    'Santander Premium Bank': { type: 'percent', value: 25 },
  };

  const COUNCIL_TAX_PAYMENT_MONTHS = [0, 3, 4, 5, 6, 7, 8, 9, 10, 11];

  const applyInflation = (billName: string, baseAmount: number, yr: number, mo: number): number => {
    if (/council\s*tax/i.test(billName) && !COUNCIL_TAX_PAYMENT_MONTHS.includes(mo)) return 0;
    if (yr < 2026 || (yr === 2026 && mo < 3)) return baseAmount;
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
        const occs = getBillOccurrencesForMonth([bill], year, month);
        let monthTotal = occs.reduce((s, o) => s + o.expectedAmount, 0);
        if (monthTotal > 0) {
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

  // ── Compute effective totals with cell overrides ──
  const effectiveMonths = useMemo(() => {
    return months.map((m, i) => {
      const incomeEff = effective("income", m.month, m.totalIncome);

      // Sum bill overrides
      let billsEff = 0;
      billRows.forEach(row => {
        billsEff += effective(`bill:${row.id}`, m.month, row.amounts[m.month]);
      });

      const groceryEff = effective("grocery", m.month, m.groceryForecast);
      const birthdayEff = effective("birthday", m.month, m.birthdayOutgoings);
      const toiletryEff = effective("toiletry", m.month, m.toiletryForecast);

      // Override expense adjustments
      let overrideExpEff = 0;
      overrideRows.filter(o => o.type === 'expense').forEach(row => {
        overrideExpEff += effective(`adj:${row.label}`, m.month, row.amounts[m.month]);
      });

      // Override income adjustments
      let overrideIncEff = 0;
      overrideRows.filter(o => o.type === 'income').forEach(row => {
        overrideIncEff += effective(`adj:${row.label}`, m.month, row.amounts[m.month]);
      });

      const totalIncome = incomeEff + overrideIncEff;
      const totalOutgoings = billsEff + groceryEff + birthdayEff + toiletryEff + overrideExpEff + m.discretionary;
      const net = totalIncome - totalOutgoings;

      return { ...m, totalIncome: totalIncome, totalOutgoings, net };
    });
  }, [months, billRows, overrideRows, overrideMapProp]);

  // Recalculate running surplus
  const effectiveWithSurplus = useMemo(() => {
    let running = 0;
    return effectiveMonths.map(m => {
      running += m.net;
      return { ...m, runningSurplus: running };
    });
  }, [effectiveMonths]);

  const cellClass = "px-1.5 sm:px-2 py-1.5 text-right text-[11px] sm:text-xs whitespace-nowrap min-w-[60px] sm:min-w-[70px]";
  const labelClass = "px-1.5 sm:px-2 py-1.5 text-[11px] sm:text-xs font-medium whitespace-nowrap sticky left-0 bg-card z-10 min-w-[90px] sm:min-w-[120px]";
  const headerClass = "px-1.5 sm:px-2 py-2 text-center text-[11px] sm:text-xs font-semibold whitespace-nowrap";

  const hasInflation = year >= 2026;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Detailed Breakdown</CardTitle>
          <div className="flex items-center gap-2">
            {canEdit && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded">
                Click any value to edit • Right-click ✎ to reset
              </span>
            )}
            {hasInflation && (
               <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded">
                 📈 Apr 2026+: Council Tax +5%, TV Licence →£180, EE +£2.50/mo, Santander +25% | Salary +3.4% | Broadband & Electric protected by contract
               </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-border">
              <th className={cn(labelClass, "bg-card")}>Category</th>
              {months.map((m) => (
                <th
                  key={m.month}
                  className={cn(headerClass, m.isPast && "text-muted-foreground", onMonthHeaderClick && "cursor-pointer hover:text-primary transition-colors")}
                  onClick={() => onMonthHeaderClick?.(m.month)}
                  title="Click for account breakdown"
                >
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
                <EditableCell
                  key={m.month}
                  value={m.totalIncome}
                  overrideValue={getOvr("income", m.month)}
                  hasOverride={hasOvr("income", m.month)}
                  className={cn(cellClass, "text-success font-medium")}
                  isEditable={canEdit}
                  onSave={(amt) => saveCell("income", m.month, amt)}
                  onReset={() => resetCell("income", m.month)}
                />
              ))}
              <td className={cn(cellClass, "font-bold text-success bg-muted/50")}>
                {fmt(effectiveWithSurplus.reduce((s, m) => s + m.totalIncome, 0))}
              </td>
            </tr>

            {/* INCOME BREAKDOWN ROWS */}
            {showIncomeBreakdown && Object.entries(incomeBreakdown).map(([source, amounts]) => (
              <tr key={source} className="border-b border-border/30 bg-success/3">
                <td className={cn(labelClass, "font-normal text-success/80 pl-6 bg-success/3 text-[11px]")}>
                  {source}
                </td>
                {amounts.map((amt, i) => (
                  <EditableCell
                    key={i}
                    value={amt}
                    overrideValue={getOvr(`income:${source}`, i)}
                    hasOverride={hasOvr(`income:${source}`, i)}
                    className={cn(cellClass, "text-[11px]", amt > 0 || hasOvr(`income:${source}`, i) ? "text-success/70" : "text-muted-foreground/30")}
                    isEditable={canEdit}
                    onSave={(a) => saveCell(`income:${source}`, i, a)}
                    onReset={() => resetCell(`income:${source}`, i)}
                  />
                ))}
                <td className={cn(cellClass, "text-[11px] font-medium bg-muted/50 text-success/70")}>
                  {fmt(amounts.reduce((s, v, i) => s + effective(`income:${source}`, i, v), 0))}
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
              const groceryPriority = 2.5;
              const hasGrocery = months.some(m => m.groceryForecast > 0);
              let groceryInserted = false;

              const rows: React.ReactNode[] = [];

              const renderGroceryRow = () => (
                <tr key="grocery-forecast" className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className={cn(labelClass, "font-normal")}>
                    <span className="flex items-center gap-1.5">
                      🛒 Groceries
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-primary/70">Est.</Badge>
                    </span>
                  </td>
                  {months.map((m, i) => (
                    <EditableCell
                      key={i}
                      value={m.groceryForecast}
                      overrideValue={getOvr("grocery", m.month)}
                      hasOverride={hasOvr("grocery", m.month)}
                      className={cn(cellClass, m.groceryForecast > 0 || hasOvr("grocery", m.month) ? "text-primary/80 italic" : "text-muted-foreground/40")}
                      isEditable={canEdit}
                      onSave={(amt) => saveCell("grocery", m.month, amt)}
                      onReset={() => resetCell("grocery", m.month)}
                    />
                  ))}
                  <td className={cn(cellClass, "font-semibold bg-muted/50 text-primary/80 italic")}>
                    {fmt(months.reduce((s, m) => s + effective("grocery", m.month, m.groceryForecast), 0))}
                  </td>
                </tr>
              );

              billRows.forEach((row) => {
                if (hasGrocery && !groceryInserted && row.priority > groceryPriority) {
                  groceryInserted = true;
                  rows.push(renderGroceryRow());
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
                      <EditableCell
                        key={i}
                        value={amt}
                        overrideValue={getOvr(`bill:${row.id}`, i)}
                        hasOverride={hasOvr(`bill:${row.id}`, i)}
                        className={cn(cellClass, amt > 0 || hasOvr(`bill:${row.id}`, i) ? "text-foreground" : "text-muted-foreground/40")}
                        isEditable={canEdit}
                        onSave={(a) => saveCell(`bill:${row.id}`, i, a)}
                        onReset={() => resetCell(`bill:${row.id}`, i)}
                      />
                    ))}
                    <td className={cn(cellClass, "font-semibold bg-muted/50")}>
                      {fmt(row.amounts.reduce((s, v, i) => s + effective(`bill:${row.id}`, i, v), 0))}
                    </td>
                  </tr>
                );
              });

              if (hasGrocery && !groceryInserted) rows.push(renderGroceryRow());

              // Birthday outgoings row
              const hasBirthdays = months.some(m => m.birthdayOutgoings > 0);
              if (hasBirthdays) {
                rows.push(
                  <tr key="birthday-outgoings" className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className={cn(labelClass, "font-normal")}>
                      <span className="flex items-center gap-1.5">🎂 Birthdays &amp; Occasions</span>
                    </td>
                    {months.map((m, i) => (
                      <EditableCell
                        key={i}
                        value={m.birthdayOutgoings}
                        overrideValue={getOvr("birthday", m.month)}
                        hasOverride={hasOvr("birthday", m.month)}
                        className={cn(cellClass, m.birthdayOutgoings > 0 || hasOvr("birthday", m.month) ? "text-foreground" : "text-muted-foreground/40")}
                        isEditable={canEdit}
                        onSave={(amt) => saveCell("birthday", m.month, amt)}
                        onReset={() => resetCell("birthday", m.month)}
                      />
                    ))}
                    <td className={cn(cellClass, "font-semibold bg-muted/50")}>
                      {fmt(months.reduce((s, m) => s + effective("birthday", m.month, m.birthdayOutgoings), 0))}
                    </td>
                  </tr>
                );
              }

              // Toiletries forecast row
              const hasToiletries = months.some(m => m.toiletryForecast > 0);
              if (hasToiletries) {
                rows.push(
                  <tr key="toiletry-forecast" className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className={cn(labelClass, "font-normal")}>
                      <span className="flex items-center gap-1.5">
                        🧴 Toiletries
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 font-normal text-primary/70">Est.</Badge>
                      </span>
                    </td>
                    {months.map((m, i) => (
                      <EditableCell
                        key={i}
                        value={m.toiletryForecast}
                        overrideValue={getOvr("toiletry", m.month)}
                        hasOverride={hasOvr("toiletry", m.month)}
                        className={cn(cellClass, m.toiletryForecast > 0 || hasOvr("toiletry", m.month) ? "text-primary/80 italic" : "text-muted-foreground/40")}
                        isEditable={canEdit}
                        onSave={(amt) => saveCell("toiletry", m.month, amt)}
                        onReset={() => resetCell("toiletry", m.month)}
                      />
                    ))}
                    <td className={cn(cellClass, "font-semibold bg-muted/50 text-primary/80 italic")}>
                      {fmt(months.reduce((s, m) => s + effective("toiletry", m.month, m.toiletryForecast), 0))}
                    </td>
                  </tr>
                );
              }

              return rows;
            })()}

            {/* Override adjustments (expense) */}
            {overrideRows.filter(o => o.type === 'expense').map((row) => (
              <tr key={row.label} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className={cn(labelClass, "font-normal text-warning")}>
                  {row.label}
                </td>
                {row.amounts.map((amt, i) => (
                  <EditableCell
                    key={i}
                    value={amt}
                    overrideValue={getOvr(`adj:${row.label}`, i)}
                    hasOverride={hasOvr(`adj:${row.label}`, i)}
                    className={cn(cellClass, amt > 0 || hasOvr(`adj:${row.label}`, i) ? "text-warning" : "text-muted-foreground/40")}
                    isEditable={canEdit}
                    onSave={(a) => saveCell(`adj:${row.label}`, i, a)}
                    onReset={() => resetCell(`adj:${row.label}`, i)}
                  />
                ))}
                <td className={cn(cellClass, "font-semibold bg-muted/50 text-warning")}>
                  {fmt(row.amounts.reduce((s, v, i) => s + effective(`adj:${row.label}`, i, v), 0))}
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
                  <EditableCell
                    key={i}
                    value={amt}
                    overrideValue={getOvr(`adj:${row.label}`, i)}
                    hasOverride={hasOvr(`adj:${row.label}`, i)}
                    className={cn(cellClass, amt > 0 || hasOvr(`adj:${row.label}`, i) ? "text-success" : "text-muted-foreground/40")}
                    displayFn={(n) => `+${fmt(n)}`}
                    isEditable={canEdit}
                    onSave={(a) => saveCell(`adj:${row.label}`, i, a)}
                    onReset={() => resetCell(`adj:${row.label}`, i)}
                  />
                ))}
                <td className={cn(cellClass, "font-semibold bg-muted/50 text-success")}>
                  {row.amounts.reduce((s, v, i) => s + effective(`adj:${row.label}`, i, v), 0) > 0
                    ? `+${fmt(row.amounts.reduce((s, v, i) => s + effective(`adj:${row.label}`, i, v), 0))}`
                    : "—"
                  }
                </td>
              </tr>
            ))}

            {/* SUBTOTAL */}
            <tr className="border-b-2 border-border font-bold bg-muted/30">
              <td className={cn(labelClass, "font-bold bg-muted/30")}>Total Outgoings</td>
              {effectiveWithSurplus.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-bold")}>
                  {fmt(m.totalOutgoings)}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50")}>
                {fmt(effectiveWithSurplus.reduce((s, m) => s + m.totalOutgoings, 0))}
              </td>
            </tr>

            {/* EMPTY ROW SPACER */}
            <tr><td colSpan={14} className="h-2" /></tr>

            {/* NET */}
            <tr className="border-b border-border">
              <td className={cn(labelClass, "font-bold")}>Net</td>
              {effectiveWithSurplus.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-bold", m.net >= 0 ? "text-success" : "text-destructive")}>
                  {m.net >= 0 ? "+" : "-"}{fmtShort(m.net)}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50", effectiveWithSurplus.reduce((s, m) => s + m.net, 0) >= 0 ? "text-success" : "text-destructive")}>
                {(() => { const n = effectiveWithSurplus.reduce((s, m) => s + m.net, 0); return `${n >= 0 ? "+" : "-"}${fmtShort(n)}`; })()}
              </td>
            </tr>

            {/* LEFT OVER / SAVINGS */}
            <tr className="border-b border-border">
              <td className={cn(labelClass, "font-bold")}>Left Over</td>
              {effectiveWithSurplus.map((m) => (
                <td key={m.month} className={cn(cellClass, "font-medium", m.net >= 0 ? "text-success" : "text-destructive")}>
                  {m.net >= 0 ? fmt(m.net) : `-${fmt(m.net)}`}
                </td>
              ))}
              <td className={cn(cellClass, "font-bold bg-muted/50")}>
                {fmt(effectiveWithSurplus.reduce((s, m) => s + Math.max(0, m.net), 0))}
              </td>
            </tr>

            {/* RUNNING SURPLUS */}
            <tr className="border-b-2 border-border">
              <td className={cn(labelClass, "font-bold")}>Running Surplus</td>
              {effectiveWithSurplus.map((m) => (
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
                {(() => { const last = effectiveWithSurplus[effectiveWithSurplus.length - 1]; return last ? `${last.runningSurplus >= 0 ? "+" : "-"}${fmtShort(last.runningSurplus)}` : "—"; })()}
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
