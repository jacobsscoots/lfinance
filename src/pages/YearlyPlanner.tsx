import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LayoutGrid, Table } from "lucide-react";
import { useYearlyPlannerData } from "@/hooks/useYearlyPlannerData";
import { useYearlyCellOverrides } from "@/hooks/useYearlyCellOverrides";
import { useBills } from "@/hooks/useBills";
import { MonthColumn } from "@/components/yearly-planner/MonthColumn";
import { YearlySummaryBar } from "@/components/yearly-planner/YearlySummaryBar";
import { DetailedYearlyTable } from "@/components/yearly-planner/DetailedYearlyTable";
import { OverrideFormDialog } from "@/components/yearly-planner/OverrideFormDialog";

export default function YearlyPlanner() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [overrideMonth, setOverrideMonth] = useState<number | null>(null);
  const [view, setView] = useState<"cards" | "table">("table");

  const { monthData, incomeBreakdown, createOverride, deleteOverride, isCreating } = useYearlyPlannerData(year);
  const { bills } = useBills();
  const { getOverride, hasOverride, upsertOverride, removeOverride } = useYearlyCellOverrides(year);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Yearly Planner</h1>
            <p className="text-muted-foreground">
              Plan ahead — see income vs outgoings across the year
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-md overflow-hidden">
              <Button
                variant={view === "cards" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8"
                onClick={() => setView("cards")}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                Cards
              </Button>
              <Button
                variant={view === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-none h-8"
                onClick={() => setView("table")}
              >
                <Table className="h-4 w-4 mr-1" />
                Detail
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setYear(y => y - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[60px] text-center">{year}</span>
              <Button variant="outline" size="icon" onClick={() => setYear(y => y + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <YearlySummaryBar months={monthData} />

        {/* Views */}
        {view === "cards" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {monthData.map((m) => (
              <MonthColumn
                key={m.month}
                data={m}
                onAddOverride={(month) => setOverrideMonth(month)}
                onDeleteOverride={deleteOverride}
              />
            ))}
          </div>
        ) : (
          <DetailedYearlyTable
            months={monthData}
            bills={bills}
            year={year}
            onAddOverride={(month) => setOverrideMonth(month)}
            onDeleteOverride={deleteOverride}
            incomeBreakdown={incomeBreakdown}
            getOverride={getOverride}
            hasOverride={hasOverride}
            onCellEdit={(rowKey, month, amount) =>
              upsertOverride({ rowKey, month, amount })
            }
            onCellReset={(rowKey, month) =>
              removeOverride({ rowKey, month })
            }
          />
        )}
      </div>

      {overrideMonth !== null && (
        <OverrideFormDialog
          open={overrideMonth !== null}
          onOpenChange={(open) => { if (!open) setOverrideMonth(null); }}
          month={overrideMonth}
          onSubmit={createOverride}
          isLoading={isCreating}
        />
      )}
    </AppLayout>
  );
}
