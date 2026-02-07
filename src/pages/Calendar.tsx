import { useState } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useCalendarData } from "@/hooks/useCalendarData";
import { CalendarGrid } from "@/components/calendar/CalendarGrid";
import { DayDetailPanel } from "@/components/calendar/DayDetailPanel";
import { getNextPayday, getCurrentPayCycle } from "@/lib/payday";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const { data, isLoading } = useCalendarData(currentDate);
  const isMobile = useIsMobile();

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const nextPayday = getNextPayday();
  const { start: cycleStart, end: cycleEnd } = getCurrentPayCycle();

  const selectedDayData = selectedDate
    ? data?.days.find((d) => format(d.date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd"))
    : undefined;

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  const handleCloseDrawer = () => {
    setSelectedDate(undefined);
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Calendar</h1>
            <p className="text-muted-foreground">
              View your bills projected across the month
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>
        </div>

        {/* Summary Cards - Stack on mobile */}
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardContent className="py-3 sm:py-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Bills This Month</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">
                £{(data?.monthTotal || 0).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
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
              <p className="text-xs sm:text-sm text-muted-foreground">Current Pay Cycle</p>
              <p className="text-base sm:text-lg font-semibold">
                {format(cycleStart, "d MMM")} – {format(cycleEnd, "d MMM")}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar and Detail Panel */}
        {isMobile ? (
          /* Mobile: Full-width calendar with drawer for details */
          <div className="space-y-4">
            {/* Month Navigator */}
            <div className="flex items-center justify-between">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-semibold">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
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

            {/* Mobile Drawer for Day Details */}
            <Drawer open={!!selectedDate && !!selectedDayData} onOpenChange={(open) => !open && handleCloseDrawer()}>
              <DrawerContent>
                <DrawerHeader>
                  <DrawerTitle>
                    {selectedDate && format(selectedDate, "EEEE, d MMMM")}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="px-4 pb-6">
                  {selectedDate && selectedDayData && (
                    <DayDetailPanel date={selectedDate} bills={selectedDayData.bills} />
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>
        ) : (
          /* Desktop: Side-by-side layout */
          <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
            {/* Calendar */}
            <div className="space-y-4">
              {/* Month Navigator */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h2 className="text-xl font-semibold">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
                <Button variant="outline" size="icon" onClick={goToNextMonth}>
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
                <DayDetailPanel date={selectedDate} bills={selectedDayData.bills} />
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
