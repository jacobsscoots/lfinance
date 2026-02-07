import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, getValueColorClass } from "@/lib/dashboardCalculations";
import { cn } from "@/lib/utils";
import { Building2, AlertTriangle, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface Account {
  id: string;
  name: string;
  displayName: string | null;
  balance: number;
  changeFromStart: number;
  isHidden: boolean;
  lastSyncedAt: string | null;
}

interface AccountsOverviewProps {
  accounts: Account[];
  isLoading?: boolean;
}

function AccountRow({ account }: { account: Account }) {
  const displayName = account.displayName || account.name;
  const needsSync = account.lastSyncedAt && 
    new Date(account.lastSyncedAt) < new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return (
    <div className={cn(
      "flex items-center justify-between py-2",
      account.isHidden && "opacity-50"
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{displayName}</span>
        {needsSync && (
          <RefreshCw className="h-3 w-3 text-amber-500 shrink-0" />
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={cn(
          "text-xs",
          getValueColorClass(account.changeFromStart)
        )}>
          {account.changeFromStart >= 0 ? "+" : ""}
          {formatCurrency(account.changeFromStart)}
        </span>
        <span className="text-sm font-medium w-24 text-right">
          {formatCurrency(account.balance)}
        </span>
      </div>
    </div>
  );
}

export function AccountsOverview({ accounts, isLoading }: AccountsOverviewProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  
  const visibleAccounts = accounts.filter(a => !a.isHidden);
  const hasHiddenAccounts = accounts.some(a => a.isHidden);
  const totalBalance = visibleAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalChange = visibleAccounts.reduce((sum, a) => sum + a.changeFromStart, 0);
  
  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <AlertTriangle className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No accounts connected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Accounts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Total row */}
        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm font-medium text-muted-foreground">Total</span>
          <div className="flex items-center gap-3">
            <span className={cn(
              "text-xs",
              getValueColorClass(totalChange)
            )}>
              {totalChange >= 0 ? "+" : ""}
              {formatCurrency(totalChange)}
            </span>
            <span className="text-sm font-bold w-24 text-right">
              {formatCurrency(totalBalance)}
            </span>
          </div>
        </div>
        
        {/* Individual accounts */}
        <div className="divide-y divide-border/50">
          {visibleAccounts.map(account => (
            <AccountRow key={account.id} account={account} />
          ))}
        </div>
        
        {hasHiddenAccounts && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Some accounts are hidden
          </p>
        )}
      </CardContent>
    </Card>
  );
}
