import { AppLayout } from "@/components/layout/AppLayout";
import { usePayCycleData, useHistoricalPayCycles } from "@/hooks/usePayCycleData";
import { formatPayCycleLabel } from "@/lib/payCycle";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock } from "lucide-react";

// Dashboard components
import { RunwayBalanceCard } from "@/components/dashboard/RunwayBalanceCard";
import { BudgetHealthCard } from "@/components/dashboard/BudgetHealthCard";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { AccountsOverview } from "@/components/dashboard/AccountsOverview";
import { UpcomingBillsExpanded } from "@/components/dashboard/UpcomingBillsExpanded";
import { SpendPaceChart } from "@/components/dashboard/SpendPaceChart";
import { OutgoingsBreakdownChart } from "@/components/dashboard/OutgoingsBreakdownChart";
import { NetTrendChart } from "@/components/dashboard/NetTrendChart";

export default function Dashboard() {
  const {
    cycle,
    cycleLabel,
    metrics,
    billsNext7Days,
    billsRestOfCycle,
    totalNext7Days,
    totalRestOfCycle,
    billLinkedSpent,
    discretionarySpent,
    alerts,
    accounts,
    isLoading,
  } = usePayCycleData();
  
  const { data: historicalData, isLoading: historicalLoading } = useHistoricalPayCycles(6);
  
  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payday Control Centre</h1>
            <p className="text-muted-foreground flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4" />
              {cycleLabel}
            </p>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto gap-1.5 text-sm py-1.5 px-3">
            <Clock className="h-4 w-4" />
            {metrics.daysRemaining} days remaining
          </Badge>
        </div>

        {/* 2-Column Layout: Main (2/3) + Sidebar (1/3) */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Runway & Balance - Key Widget */}
            <RunwayBalanceCard metrics={metrics} isLoading={isLoading} />
            
            {/* Charts Row */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="md:col-span-2 lg:col-span-1">
                <SpendPaceChart 
                  data={metrics.dailySpending} 
                  isOverPace={metrics.isOverPace}
                  isLoading={isLoading} 
                />
              </div>
              <OutgoingsBreakdownChart 
                billsTotal={billLinkedSpent}
                otherTotal={discretionarySpent}
                isLoading={isLoading} 
              />
              <NetTrendChart 
                data={historicalData} 
                isLoading={historicalLoading} 
              />
            </div>
            
            {/* Budget Health Snapshot */}
            <BudgetHealthCard metrics={metrics} isLoading={isLoading} />
            
            {/* Upcoming Bills - Expanded */}
            <UpcomingBillsExpanded
              billsNext7Days={billsNext7Days}
              billsRestOfCycle={billsRestOfCycle}
              totalNext7Days={totalNext7Days}
              totalRestOfCycle={totalRestOfCycle}
              discretionaryRemaining={metrics.discretionaryRemaining}
              isLoading={isLoading}
            />
          </div>
          
          {/* Sidebar Column */}
          <div className="space-y-6">
            {/* Alerts & Actions */}
            <AlertsPanel alerts={alerts} isLoading={isLoading} />
            
            {/* Accounts Overview */}
            <AccountsOverview accounts={accounts} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
