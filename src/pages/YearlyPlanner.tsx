import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useYearlyPlannerData } from "@/hooks/useYearlyPlannerData";
import { MonthColumn } from "@/components/yearly-planner/MonthColumn";
import { YearlySummaryBar } from "@/components/yearly-planner/YearlySummaryBar";
import { OverrideFormDialog } from "@/components/yearly-planner/OverrideFormDialog";

export default function YearlyPlanner() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [overrideMonth, setOverrideMonth] = useState<number | null>(null);

  const { monthData, createOverride, deleteOverride, isCreating } = useYearlyPlannerData(year);

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Yearly Planner</h1>
            <p className="text-muted-foreground">
              Plan ahead — see income vs outgoings across the year
            </p>
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

        {/* Summary */}
        <YearlySummaryBar months={monthData} />

        {/* Monthly Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-3">
          {monthData.map((m) => (
            <MonthColumn
              key={m.month}
              data={m}
              onAddOverride={(month) => setOverrideMonth(month)}
              onDeleteOverride={deleteOverride}
            />
          ))}
        </div>
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
