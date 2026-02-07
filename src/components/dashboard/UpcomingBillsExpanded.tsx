import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  Receipt, 
  Repeat,
  CircleDollarSign,
} from "lucide-react";
import { formatCurrency } from "@/lib/dashboardCalculations";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  is_subscription?: boolean | null;
  is_variable?: boolean | null;
  category?: {
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
}

interface UpcomingBillsExpandedProps {
  billsNext7Days: Bill[];
  billsRestOfCycle: Bill[];
  totalNext7Days: number;
  totalRestOfCycle: number;
  discretionaryRemaining: number;
  isLoading?: boolean;
}

function BillItem({ bill }: { bill: Bill }) {
  const daysUntil = differenceInDays(bill.dueDate, new Date());
  const isUrgent = daysUntil <= 2;
  
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2 min-w-0">
        {bill.is_subscription ? (
          <Repeat className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <Receipt className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{bill.name}</p>
          <p className={cn(
            "text-xs",
            isUrgent ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
          )}>
            {daysUntil === 0 ? "Today" : daysUntil === 1 ? "Tomorrow" : `${daysUntil} days`}
          </p>
        </div>
      </div>
      <span className={cn(
        "text-sm font-medium shrink-0",
        bill.is_variable && "text-muted-foreground"
      )}>
        {bill.is_variable ? "~" : ""}{formatCurrency(Number(bill.amount))}
      </span>
    </div>
  );
}

function BillSection({ 
  title, 
  bills, 
  icon,
  defaultOpen = true,
}: { 
  title: string; 
  bills: Bill[]; 
  icon: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  
  if (bills.length === 0) return null;
  
  const total = bills.reduce((sum, b) => sum + Number(b.amount), 0);
  
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-muted/50 rounded-lg px-2 -mx-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {bills.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{formatCurrency(total)}</span>
          <ChevronDown className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )} />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-6 divide-y divide-border/50">
          {bills.map(bill => (
            <BillItem key={bill.id} bill={bill} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function UpcomingBillsExpanded({
  billsNext7Days,
  billsRestOfCycle,
  totalNext7Days,
  totalRestOfCycle,
  discretionaryRemaining,
  isLoading,
}: UpcomingBillsExpandedProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  const allBills = [...billsNext7Days, ...billsRestOfCycle];
  const subscriptions = allBills.filter(b => b.is_subscription);
  const variableBills = allBills.filter(b => b.is_variable && !b.is_subscription);
  const fixedBills = allBills.filter(b => !b.is_subscription && !b.is_variable);
  
  const totalCommitted = totalNext7Days + totalRestOfCycle;
  const hasRunwayRisk = totalCommitted > discretionaryRemaining;
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calendar className="h-5 w-5" />
            Upcoming Bills
          </CardTitle>
          {hasRunwayRisk && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Risk
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary boxes */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Next 7 days</p>
            <p className="text-lg font-bold">{formatCurrency(totalNext7Days)}</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Rest of cycle</p>
            <p className="text-lg font-bold">{formatCurrency(totalRestOfCycle)}</p>
          </div>
        </div>
        
        {/* Risk warning */}
        {hasRunwayRisk && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">
              Committed bills ({formatCurrency(totalCommitted)}) exceed discretionary funds ({formatCurrency(discretionaryRemaining)})
            </p>
          </div>
        )}
        
        {/* Bill sections */}
        {allBills.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            No bills due this cycle
          </div>
        ) : (
          <div className="space-y-2">
            <BillSection
              title="Fixed Bills"
              bills={fixedBills}
              icon={<Receipt className="h-4 w-4 text-muted-foreground" />}
            />
            <BillSection
              title="Subscriptions"
              bills={subscriptions}
              icon={<Repeat className="h-4 w-4 text-muted-foreground" />}
            />
            <BillSection
              title="Variable Bills"
              bills={variableBills}
              icon={<CircleDollarSign className="h-4 w-4 text-muted-foreground" />}
              defaultOpen={false}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
