import { AppLayout } from "@/components/layout/AppLayout";
import { PayCycleCard } from "@/components/dashboard/PayCycleCard";
import { MonthSummaryCard } from "@/components/dashboard/MonthSummaryCard";
import { UpcomingBillsCard } from "@/components/dashboard/UpcomingBillsCard";
import { QuickActionsCard } from "@/components/dashboard/QuickActionsCard";

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">
            Your financial overview at a glance
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Pay Cycle - Full width on mobile, 1 column on larger screens */}
          <div className="md:col-span-1">
            <PayCycleCard />
          </div>

          {/* Month Summary */}
          <div className="md:col-span-1">
            <MonthSummaryCard />
          </div>

          {/* Quick Actions */}
          <div className="md:col-span-2 lg:col-span-1">
            <QuickActionsCard />
          </div>

          {/* Upcoming Bills - Full width on tablet */}
          <div className="md:col-span-2 lg:col-span-2">
            <UpcomingBillsCard />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
