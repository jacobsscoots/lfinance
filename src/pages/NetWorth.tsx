import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Landmark, PieChart, Wallet2 } from "lucide-react";
import { useNetWorthData } from "@/hooks/useNetWorthData";

function formatCurrency(v: number) {
  const abs = Math.abs(v);
  return `${v < 0 ? "-" : ""}£${abs.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function NetWorth() {
  const { data, isLoading } = useNetWorthData();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6 animate-fade-in">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Net Worth</h1>
          <p className="text-muted-foreground">Your complete financial position at a glance</p>
        </div>

        {/* Headline */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Net Worth</p>
            <p className={`text-4xl font-bold ${data.netWorth >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(data.netWorth)}
            </p>
          </CardContent>
        </Card>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Landmark className="h-4 w-4" /> Bank Accounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(data.bankTotal)}</p>
              <p className="text-xs text-muted-foreground">{data.bankAccounts.length} account(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <PieChart className="h-4 w-4" /> Investments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(data.investmentTotal)}</p>
              <p className="text-xs text-muted-foreground">{data.investmentAccounts.length} account(s)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                <Wallet2 className="h-4 w-4" /> Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">{formatCurrency(data.debtTotal)}</p>
              <p className="text-xs text-muted-foreground">{data.debtAccounts.length} open debt(s)</p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Assets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" /> Assets
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.bankAccounts.length === 0 && data.investmentAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">No assets tracked yet</p>
              )}
              {data.bankAccounts.map((a, i) => (
                <div key={`bank-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.type}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-success">{formatCurrency(a.balance)}</span>
                </div>
              ))}
              {data.investmentAccounts.map((a, i) => (
                <div key={`inv-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <PieChart className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      {a.provider && <p className="text-xs text-muted-foreground">{a.provider}</p>}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-success">{formatCurrency(a.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t font-medium text-sm">
                <span>Total Assets</span>
                <span className="text-success">{formatCurrency(data.totalAssets)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Liabilities */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Liabilities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.debtAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">No outstanding debts 🎉</p>
              )}
              {data.debtAccounts.map((d, i) => (
                <div key={`debt-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Wallet2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <Badge variant="outline" className="text-[10px] capitalize">{d.type.replace("_", " ")}</Badge>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-destructive">{formatCurrency(d.balance)}</span>
                </div>
              ))}
              {data.debtAccounts.length > 0 && (
                <div className="flex items-center justify-between pt-2 border-t font-medium text-sm">
                  <span>Total Liabilities</span>
                  <span className="text-destructive">{formatCurrency(data.totalLiabilities)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}