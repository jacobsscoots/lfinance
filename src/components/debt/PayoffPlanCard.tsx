import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Debt } from "@/hooks/useDebts";
import { useDebtSettings, PayoffStrategy } from "@/hooks/useDebtSettings";
import { generatePayoffPlan, calculateInterestSaved, getDebtTypeLabel } from "@/lib/debtCalculations";
import { format } from "date-fns";
import { TrendingDown, Calendar, Percent, AlertTriangle } from "lucide-react";

interface PayoffPlanCardProps {
  debts: Debt[];
}

export function PayoffPlanCard({ debts }: PayoffPlanCardProps) {
  const { settings, upsertSettings } = useDebtSettings();
  const [budget, setBudget] = useState<number>(settings?.monthly_budget || 0);
  const [strategy, setStrategy] = useState<PayoffStrategy>(settings?.preferred_strategy || 'avalanche');

  const openDebts = debts.filter(d => d.status === 'open');
  const totalMinPayments = openDebts.reduce((sum, d) => sum + (Number(d.min_payment) || 0), 0);

  const effectiveBudget = budget || totalMinPayments;
  const plan = generatePayoffPlan(openDebts, effectiveBudget, strategy);
  const interestComparison = effectiveBudget > 0 ? calculateInterestSaved(openDebts, effectiveBudget) : null;

  const hasAprMissing = openDebts.some(d => !d.apr);

  const handleSaveSettings = () => {
    upsertSettings.mutate({
      monthly_budget: budget || null,
      preferred_strategy: strategy,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Payoff Plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Inputs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget">Monthly Budget (£)</Label>
            <Input
              id="budget"
              type="number"
              placeholder={`Min: ${totalMinPayments}`}
              value={budget || ''}
              onChange={(e) => setBudget(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Minimum payments total: £{totalMinPayments}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Strategy</Label>
            <RadioGroup value={strategy} onValueChange={(v) => setStrategy(v as PayoffStrategy)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="avalanche" id="avalanche" />
                <Label htmlFor="avalanche" className="font-normal cursor-pointer">
                  Avalanche (highest APR first)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="snowball" id="snowball" />
                <Label htmlFor="snowball" className="font-normal cursor-pointer">
                  Snowball (lowest balance first)
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Button onClick={handleSaveSettings} variant="outline" size="sm">
          Save as Default
        </Button>

        {hasAprMissing && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 text-amber-600">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-sm">
              Some debts are missing APR. Interest calculations may be underestimated.
            </p>
          </div>
        )}

        {/* Results Summary */}
        {effectiveBudget > 0 && plan.schedule.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 rounded-lg bg-muted text-center">
                <Calendar className="h-5 w-5 mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Debt-Free Date</p>
                <p className="text-lg font-semibold">
                  {plan.debtFreeDate ? format(plan.debtFreeDate, 'MMM yyyy') : 'N/A'}
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted text-center">
                <TrendingDown className="h-5 w-5 mx-auto mb-2 text-destructive" />
                <p className="text-sm text-muted-foreground">Total Interest</p>
                <p className="text-lg font-semibold">
                  {formatCurrency(plan.totalInterestPaid)}
                </p>
              </div>

              {interestComparison && strategy === 'avalanche' && interestComparison.saved > 0 && (
                <div className="p-4 rounded-lg bg-green-500/10 text-center">
                  <Percent className="h-5 w-5 mx-auto mb-2 text-green-600" />
                  <p className="text-sm text-green-600">Saved vs Snowball</p>
                  <p className="text-lg font-semibold text-green-600">
                    {formatCurrency(interestComparison.saved)}
                  </p>
                </div>
              )}
            </div>

            {/* Payoff Order */}
            <div className="space-y-3">
              <h4 className="font-medium">Payoff Order</h4>
              <div className="space-y-2">
                {plan.schedule
                  .sort((a, b) => {
                    if (!a.payoffDate) return 1;
                    if (!b.payoffDate) return -1;
                    return a.payoffDate.getTime() - b.payoffDate.getTime();
                  })
                  .map((item, index) => {
                    const debt = openDebts.find(d => d.id === item.debtId);
                    return (
                      <div 
                        key={item.debtId}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <span className="h-6 w-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-medium">{item.creditorName}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatCurrency(Number(item.currentBalance))}
                              {item.apr && ` • ${item.apr}% APR`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">
                            {item.payoffDate ? format(item.payoffDate, 'MMM yyyy') : 'N/A'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Interest: {formatCurrency(item.totalInterest)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Monthly Schedule Preview */}
            {plan.monthlyBreakdown.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium">Monthly Schedule (Next 6 Months)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4">Month</th>
                        {openDebts.map(d => (
                          <th key={d.id} className="text-right py-2 px-2 min-w-[80px]">
                            {d.creditor_name.slice(0, 10)}
                          </th>
                        ))}
                        <th className="text-right py-2 pl-4">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.monthlyBreakdown.slice(0, 6).map(month => {
                        const total = month.allocations.reduce((sum, a) => sum + a.amount, 0);
                        return (
                          <tr key={month.month} className="border-b border-muted">
                            <td className="py-2 pr-4">{month.month}</td>
                            {openDebts.map(d => {
                              const alloc = month.allocations.find(a => a.debtId === d.id);
                              return (
                                <td key={d.id} className="text-right py-2 px-2">
                                  {alloc ? `£${Math.round(alloc.amount)}` : '-'}
                                </td>
                              );
                            })}
                            <td className="text-right py-2 pl-4 font-medium">
                              £{Math.round(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {openDebts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>No open debts to plan for.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
