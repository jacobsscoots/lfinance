import { useState, useMemo } from "react";
import { format, subDays, addDays } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles } from "lucide-react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { useBillOccurrences } from "@/hooks/useBillOccurrences";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { DayDetailPanel } from "@/components/calendar/DayDetailPanel";
import { getCurrentPayCycle, getNextPayday } from "@/lib/payday";
import { getPayCycleForDate, getNextPayCycle, getPrevPayCycle, formatPayCycleLabel } from "@/lib/payCycle";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { toPaydaySettings } from "@/lib/payCycle";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export default function Calendar() {
  const { effectiveSettings } = usePaydaySettings();
  const paydaySettings = useMemo(() => effectiveSettings ? toPaydaySettings(effectiveSettings) : undefined, [effectiveSettings]);

  // Navigate by pay cycle instead of calendar month
  const [currentCycle, setCurrentCycle] = useState(() => {
    return paydaySettings ? getPayCycleForDate(new Date(), paydaySettings) : getPayCycleForDate(new Date());
  });

  // Update cycle when settings load
  const cycle = useMemo(() => {
    if (paydaySettings) {
      return getPayCycleForDate(currentCycle.start, paydaySettings);
    }
    return currentCycle;
  }, [currentCycle.start, paydaySettings]);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { data, isLoading } = useCalendarData(cycle.start, cycle.end);
  const isMobile = useIsMobile();

  // Bill occurrences hook — pass full cycle range for cross-month support
  const year = cycle.start.getFullYear();
  const month = cycle.start.getMonth();
  const { markPaid, skipOccurrence, resetOccurrence, autoMatchCount, applyAutoMatches } = useBillOccurrences(year, month, cycle.start, cycle.end);

  const goToPreviousCycle = () => {
    setCurrentCycle(prev => getPrevPayCycle(prev, paydaySettings));
  };
  const goToNextCycle = () => {
    setCurrentCycle(prev => getNextPayCycle(prev, paydaySettings));
  };
  const goToToday = () => {
    const todayCycle = paydaySettings ? getPayCycleForDate(new Date(), paydaySettings) : getPayCycleForDate(new Date());
    setCurrentCycle(todayCycle);
    setSelectedDate(new Date());
  };

  const nextPayday = paydaySettings ? getNextPayday(new Date(), paydaySettings) : getNextPayday();

  const selectedDayData = selectedDate
    ? data?.days.find((d) => format(d.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd"))
    : undefined;

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCloseDrawer = () => {
    setSelectedDate(undefined);
  };

  // Action handlers that create occurrence IDs from bill ID and date
  const handleMarkPaid = (billId: string, dueDate: Date) => {
    if (billId.startsWith("toiletry-")) return;
    const occurrenceId = `${billId}-${format(dueDate, "yyyy-MM-dd")}`;
    markPaid.mutate({ occurrenceId });
  };

  const handleSkip = (billId: string, dueDate: Date) => {
    if (billId.startsWith("toiletry-")) return;
    const occurrenceId = `${billId}-${format(dueDate, "yyyy-MM-dd")}`;
    skipOccurrence.mutate(occurrenceId);
  };

  const handleReset = (billId: string, dueDate: Date) => {
    if (billId.startsWith("toiletry-")) return;
    const occurrenceId = `${billId}-${format(dueDate, "yyyy-MM-dd")}`;
    resetOccurrence.mutate(occurrenceId);
  };

  const paidCount = data?.days.filter(d => d.isInPayCycle).flatMap(d => d.bills).filter(b => b.isPaid || b.status === "paid").length || 0;
  const totalBillCount = data?.days.filter(d => d.isInPayCycle).flatMap(d => d.bills).length || 0;

  const cycleLabel = formatPayCycleLabel(cycle);

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-muted-foreground">
              View your bills across the pay cycle
            </p>
          </div>
          <div className="flex items-center gap-2">
            {autoMatchCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => applyAutoMatches.mutate()}
                disabled={applyAutoMatches.isPending}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Auto-match {autoMatchCount} bill{autoMatchCount > 1 ? "s" : ""}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
          <Card>
            <CardContent className="py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Bills This Cycle</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">
                £{(data?.monthTotal || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Status</p>
              <p className="text-base sm:text-lg font-semibold">
                {paidCount}/{totalBillCount} paid
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Next Payday</p>
              <p className="text-base sm:text-lg font-semibold">
                {format(nextPayday, "EEE, d MMM")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Pay Cycle</p>
              <p className="text-base sm:text-lg font-semibold">
                {format(cycle.start, "d MMM")} – {format(cycle.end, "d MMM")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar and Detail Panel */}
        {isMobile ? (
          <div className="space-y-4">
            {/* Cycle Navigator */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPreviousCycle}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {cycleLabel}
              </h2>
              <Button variant="outline" size="icon" onClick={goToNextCycle}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {isLoading ? (
              <div className="border rounded-lg p-4">
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </div>
            ) : data?.days.length ? (
              <CalendarGrid
                days={data.days}
                selectedDate={selectedDate}
                onSelectDate={handleDateSelect}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No data available</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm">
                    Add some bills to see them projected on the calendar.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Mobile Drawer */}
            <Drawer open={!!selectedDate && !!selectedDayData} onOpenChange={(open) => !open && handleCloseDrawer()}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>
                    {selectedDate && format(selectedDate, "EEEE, d MMMM")}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-6">
                  {selectedDate && selectedDayData && (
                    <DayDetailPanel 
                      date={selectedDate} 
                      bills={selectedDayData.bills}
                      onMarkPaid={handleMarkPaid}
                      onSkip={handleSkip}
                      onReset={handleReset}
                    />
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Calendar */}
            <div className="space-y-4">
              {/* Cycle Navigator */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={goToPreviousCycle}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {cycleLabel}
                </h2>
                <Button variant="outline" size="icon" onClick={goToNextCycle}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {isLoading ? (
                <div className="border rounded-lg p-4">
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 35 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                </div>
              ) : data?.days.length ? (
                <CalendarGrid
                  days={data.days}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarDays className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No data available</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm">
                      Add some bills to see them projected on the calendar.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Day Detail Sidebar */}
            <div>
              {selectedDate && selectedDayData ? (
                <DayDetailPanel 
                  date={selectedDate} 
                  bills={selectedDayData.bills}
                  onMarkPaid={handleMarkPaid}
                  onSkip={handleSkip}
                  onReset={handleReset}
                />
              ) : (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Click a day to see details</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
