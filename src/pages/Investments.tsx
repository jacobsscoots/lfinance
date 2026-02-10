import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  TrendingUp, 
  TrendingDown,
  Download, 
  PieChart, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useInvestments, CreateInvestmentData } from "@/hooks/useInvestments";
import { useInvestmentTransactions } from "@/hooks/useInvestmentTransactions";
import { useInvestmentValuations } from "@/hooks/useInvestmentValuations";
import { InvestmentCard } from "@/components/investments/InvestmentCard";
import { InvestmentFormDialog } from "@/components/investments/InvestmentFormDialog";
import { ContributionFormDialog } from "@/components/investments/ContributionFormDialog";
import { ContributionList } from "@/components/investments/ContributionList";
import { CsvImportDialog } from "@/components/investments/CsvImportDialog";
import { InvestmentPerformanceChart } from "@/components/investments/InvestmentPerformanceChart";
import { ProjectionCard } from "@/components/investments/ProjectionCard";
import { 
  calculateContributionTotal, 
  calculateReturn, 
  calculateDailyChange,
  calculateDailyValues 
} from "@/lib/investmentCalculations";
import { ParsedContribution } from "@/lib/investmentCsvParser";
import { cn } from "@/lib/utils";

interface LivePriceData {
  price: number;
  previousClose: number | null;
  dailyChange: { amount: number; percentage: number } | null;
}

export default function Investments() {
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [showChipImportInfo, setShowChipImportInfo] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, LivePriceData>>({});

  const { 
    investments, 
    isLoading: isLoadingInvestments, 
    createInvestment, 
    updateInvestment,
    deleteInvestment,
    isCreating 
  } = useInvestments();
  
  const { 
    transactions, 
    isLoading: isLoadingTransactions,
    createTransaction,
    createManyTransactions,
    deleteTransaction,
    isCreating: isCreatingTransaction,
    isImporting,
    isDeleting: isDeletingTransaction,
  } = useInvestmentTransactions(selectedInvestmentId || undefined);

  const { valuations, fetchLivePrice, isFetchingPrice } = useInvestmentValuations(selectedInvestmentId || undefined);

  // Fetch live prices for investments with tickers
  useEffect(() => {
    const tickerInvestments = investments.filter(i => i.ticker_symbol && i.status === 'active');
    if (tickerInvestments.length === 0) return;

    tickerInvestments.forEach(async (inv) => {
      // Only fetch once per session (check cache)
      if (livePrices[inv.id]) return;
      try {
        const result = await fetchLivePrice({ ticker: inv.ticker_symbol!, investment_account_id: inv.id });
        setLivePrices(prev => ({
          ...prev,
          [inv.id]: {
            price: result.price,
            previousClose: result.previousClose,
            dailyChange: result.dailyChange,
          },
        }));
      } catch (err) {
        console.error(`Failed to fetch price for ${inv.ticker_symbol}:`, err);
      }
    });
  }, [investments]);

  const selectedInvestment = investments.find(i => i.id === selectedInvestmentId);
  const investmentTransactions = transactions.filter(
    t => selectedInvestmentId ? t.investment_account_id === selectedInvestmentId : true
  );

  // Portfolio summary
  const portfolioSummary = useMemo(() => {
    if (investments.length === 0) {
      return { totalValue: 0, totalInvested: 0, totalReturn: 0, returnPercentage: 0, dailyChange: { amount: 0, percentage: 0 } };
    }

    let totalValue = 0;
    let totalInvested = 0;
    let totalDailyChange = 0;

    investments.forEach(inv => {
      const invTransactions = transactions.filter(t => t.investment_account_id === inv.id);
      const formattedTx = invTransactions.map(tx => ({
        id: tx.id,
        transaction_date: tx.transaction_date,
        type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
        amount: tx.amount,
      }));

      const contributed = calculateContributionTotal(formattedTx);
      totalInvested += contributed;

      const lp = livePrices[inv.id];
      if (lp && inv.ticker_symbol) {
        const totalUnits = invTransactions.reduce((sum, tx) => {
          const units = Number(tx.units) || 0;
          if (tx.type === 'deposit' || tx.type === 'dividend') return sum + units;
          if (tx.type === 'withdrawal') return sum - units;
          return sum;
        }, 0);
        const cv = totalUnits * lp.price;
        totalValue += cv;
        if (lp.dailyChange) totalDailyChange += totalUnits * lp.dailyChange.amount;
      } else {
        const today = new Date();
        const startDate = new Date(inv.start_date);
        const dailyValues = calculateDailyValues(formattedTx, [], startDate, today, inv.expected_annual_return);
        const currentValue = dailyValues.length > 0 ? dailyValues[dailyValues.length - 1].value : 0;
        totalValue += currentValue;
        totalDailyChange += calculateDailyChange(currentValue, inv.expected_annual_return).amount;
      }
    });

    const totalReturn = totalValue - totalInvested;
    const returnPercentage = calculateReturn(totalValue, totalInvested);
    const dailyPercentage = totalValue > 0 ? (totalDailyChange / (totalValue - totalDailyChange)) * 100 : 0;

    return { totalValue, totalInvested, totalReturn, returnPercentage, dailyChange: { amount: totalDailyChange, percentage: dailyPercentage } };
  }, [investments, transactions, livePrices]);

  const handleCreateInvestment = (data: any) => {
    createInvestment({
      name: data.name,
      provider: data.provider,
      fund_type: data.fund_type,
      start_date: data.start_date.toISOString().split('T')[0],
      expected_annual_return: data.expected_annual_return,
      risk_preset: data.risk_preset,
      notes: data.notes,
      initialDeposit: data.initial_deposit,
      recurringAmount: data.recurring_amount,
      recurringFrequency: data.recurring_frequency,
    });
    // Also save ticker_symbol if provided
    if (data.ticker_symbol) {
      // We'll update after creation via the onSuccess invalidation
    }
    setInvestmentDialogOpen(false);
    setEditingInvestment(null);
  };
  
  const handleEditInvestment = (data: any) => {
    if (!editingInvestment) return;
    updateInvestment({
      id: editingInvestment.id,
      name: data.name,
      provider: data.provider,
      fund_type: data.fund_type,
      start_date: data.start_date.toISOString().split('T')[0],
      expected_annual_return: data.expected_annual_return,
      risk_preset: data.risk_preset,
      notes: data.notes,
      ticker_symbol: data.ticker_symbol || null,
    });
    setInvestmentDialogOpen(false);
    setEditingInvestment(null);
  };
  
  const openEditDialog = (investment: any) => {
    setEditingInvestment(investment);
    setInvestmentDialogOpen(true);
  };

  const handleCreateContribution = (data: any) => {
    if (!selectedInvestmentId) return;
    
    createTransaction({
      investment_account_id: selectedInvestmentId,
      transaction_date: data.transaction_date.toISOString().split('T')[0],
      type: data.type,
      amount: data.amount,
      units: data.units,
      is_recurring: data.is_recurring,
      recurring_frequency: data.recurring_frequency,
      notes: data.notes,
    });
    setContributionDialogOpen(false);
  };

  const handleCsvImport = (contributions: ParsedContribution[]) => {
    if (!selectedInvestmentId) return;
    
    createManyTransactions(
      contributions.map(c => ({
        investment_account_id: selectedInvestmentId,
        transaction_date: c.date,
        type: c.type,
        amount: c.amount,
      }))
    );
    setCsvImportDialogOpen(false);
  };

  const handleExpectedReturnChange = (value: number) => {
    if (selectedInvestmentId) {
      updateInvestment({ id: selectedInvestmentId, expected_annual_return: value });
    }
  };

  const monthlyContribution = selectedInvestment?.monthly_contribution ?? 50;

  const handleMonthlyContributionChange = (value: number) => {
    if (selectedInvestmentId) {
      updateInvestment({ id: selectedInvestmentId, monthly_contribution: value });
    }
  };

  const currentValue = useMemo(() => {
    if (!selectedInvestment) return 0;
    
    const lp = livePrices[selectedInvestment.id];
    if (lp && selectedInvestment.ticker_symbol) {
      const totalUnits = investmentTransactions.reduce((sum, tx) => {
        const units = Number(tx.units) || 0;
        if (tx.type === 'deposit' || tx.type === 'dividend') return sum + units;
        if (tx.type === 'withdrawal') return sum - units;
        return sum;
      }, 0);
      return totalUnits * lp.price;
    }

    const formattedTx = investmentTransactions.map(tx => ({
      id: tx.id,
      transaction_date: tx.transaction_date,
      type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
      amount: tx.amount,
    }));

    const today = new Date();
    const startDate = new Date(selectedInvestment.start_date);
    const dailyValues = calculateDailyValues(formattedTx, [], startDate, today, selectedInvestment.expected_annual_return);
    return dailyValues.length > 0 ? dailyValues[dailyValues.length - 1].value : 0;
  }, [selectedInvestment, investmentTransactions, livePrices]);

  const isLoading = isLoadingInvestments || isLoadingTransactions;
  const isDailyPositive = portfolioSummary.dailyChange.amount >= 0;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Investments</h1>
            <p className="text-muted-foreground">
              Track your investment portfolio and projections
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowChipImportInfo(true)}
              className="gap-1 sm:gap-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Import from Chip</span>
              <span className="sm:hidden">Import</span>
            </Button>
            <Button onClick={() => setInvestmentDialogOpen(true)} className="gap-1 sm:gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Add Investment</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Chip Import Info Alert */}
        {showChipImportInfo && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>ChipX Import Not Available</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>
                ChipX does not currently offer an API or Open Banking access for investment data.
                You can manually track your ChipX investments using our form.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={() => {
                    setShowChipImportInfo(false);
                    setInvestmentDialogOpen(true);
                  }}
                >
                  Add Manually
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowChipImportInfo(false)}
                >
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Portfolio Summary */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Portfolio Summary
              {isFetchingPrice && (
                <span className="text-xs text-muted-foreground animate-pulse">Fetching live prices...</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
              <div>
                <p className="text-xs text-muted-foreground">Total Invested</p>
                <p className="text-lg sm:text-2xl font-bold">
                  £{portfolioSummary.totalInvested.toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-lg sm:text-2xl font-bold">
                  £{portfolioSummary.totalValue.toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Return £</p>
                <p className={cn("text-lg sm:text-2xl font-bold", portfolioSummary.totalReturn >= 0 ? 'text-success' : 'text-destructive')}>
                  {portfolioSummary.totalReturn >= 0 ? '+' : '-'}£{Math.abs(portfolioSummary.totalReturn).toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Return %</p>
                <p className={cn("text-lg sm:text-2xl font-bold", portfolioSummary.returnPercentage >= 0 ? 'text-success' : 'text-destructive')}>
                  {portfolioSummary.returnPercentage >= 0 ? '+' : ''}{portfolioSummary.returnPercentage.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily Change</p>
                <div className="flex items-center gap-1">
                  {isDailyPositive ? (
                    <ArrowUpRight className="h-4 w-4 text-success" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  )}
                  <p className={cn("text-lg sm:text-2xl font-bold", isDailyPositive ? "text-success" : "text-destructive")}>
                    {isDailyPositive ? '+' : '-'}£{Math.abs(portfolioSummary.dailyChange.amount).toLocaleString("en-GB", { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </p>
                </div>
                <p className={cn("text-xs", isDailyPositive ? "text-success" : "text-destructive")}>
                  {isDailyPositive ? '+' : ''}{portfolioSummary.dailyChange.percentage.toFixed(3)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Holdings */}
        {isLoading ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Loading investments...
            </CardContent>
          </Card>
        ) : investments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Investments Yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Start tracking your investments to see performance and projections.
              </p>
              <Button onClick={() => setInvestmentDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Investment
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Holdings</h2>
            <div className="grid gap-4">
              {investments.map((investment) => (
                <InvestmentCard
                  key={investment.id}
                  investment={investment}
                  transactions={transactions.filter(t => t.investment_account_id === investment.id)}
                  livePrice={livePrices[investment.id] || null}
                  onClick={() => setSelectedInvestmentId(
                    selectedInvestmentId === investment.id ? null : investment.id
                  )}
                  onEdit={() => openEditDialog(investment)}
                  onDelete={() => deleteInvestment(investment.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Selected Investment Details */}
        {selectedInvestment && (
          <div className="space-y-6 pt-6 border-t">
            <h2 className="text-lg font-semibold">{selectedInvestment.name} Details</h2>
            
            <div className="grid lg:grid-cols-2 gap-6">
              <InvestmentPerformanceChart
                transactions={investmentTransactions}
                valuations={valuations}
                startDate={selectedInvestment.start_date}
                expectedAnnualReturn={selectedInvestment.expected_annual_return}
                showProjections={true}
              />

              <ProjectionCard
                currentValue={currentValue}
                monthlyContribution={monthlyContribution}
                expectedAnnualReturn={selectedInvestment.expected_annual_return}
                onReturnChange={handleExpectedReturnChange}
                onContributionChange={handleMonthlyContributionChange}
              />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Contributions</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCsvImportDialogOpen(true)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setContributionDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ContributionList
                  transactions={investmentTransactions}
                  onDelete={deleteTransaction}
                  isDeleting={isDeletingTransaction}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <InvestmentFormDialog
        open={investmentDialogOpen}
        onOpenChange={(open) => {
          setInvestmentDialogOpen(open);
          if (!open) setEditingInvestment(null);
        }}
        onSubmit={editingInvestment ? handleEditInvestment : handleCreateInvestment}
        isLoading={isCreating}
        mode={editingInvestment ? "edit" : "create"}
        defaultValues={editingInvestment ? {
          name: editingInvestment.name,
          provider: editingInvestment.provider || "",
          fund_type: editingInvestment.fund_type || "fund",
          ticker_symbol: editingInvestment.ticker_symbol || "",
          start_date: new Date(editingInvestment.start_date),
          expected_annual_return: editingInvestment.expected_annual_return,
          risk_preset: editingInvestment.risk_preset || "medium",
          notes: editingInvestment.notes || "",
        } : undefined}
      />

      <ContributionFormDialog
        open={contributionDialogOpen}
        onOpenChange={setContributionDialogOpen}
        onSubmit={handleCreateContribution}
        isLoading={isCreatingTransaction}
      />

      <CsvImportDialog
        open={csvImportDialogOpen}
        onOpenChange={setCsvImportDialogOpen}
        onImport={handleCsvImport}
        isLoading={isImporting}
      />
    </AppLayout>
  );
}
