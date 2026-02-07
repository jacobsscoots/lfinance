import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, 
  TrendingUp, 
  Download, 
  PieChart, 
  Wallet,
  ArrowUpRight,
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

export default function Investments() {
  const [investmentDialogOpen, setInvestmentDialogOpen] = useState(false);
  const [contributionDialogOpen, setContributionDialogOpen] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string | null>(null);
  const [showChipImportInfo, setShowChipImportInfo] = useState(false);

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

  const { valuations } = useInvestmentValuations(selectedInvestmentId || undefined);

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

    investments.forEach(inv => {
      const invTransactions = transactions.filter(t => t.investment_account_id === inv.id);
      const formattedTx = invTransactions.map(tx => ({
        id: tx.id,
        transaction_date: tx.transaction_date,
        type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
        amount: tx.amount,
      }));

      const today = new Date();
      const startDate = new Date(inv.start_date);
      const dailyValues = calculateDailyValues(
        formattedTx,
        [],
        startDate,
        today,
        inv.expected_annual_return
      );

      const currentValue = dailyValues.length > 0 
        ? dailyValues[dailyValues.length - 1].value 
        : 0;
      
      totalValue += currentValue;
      totalInvested += calculateContributionTotal(formattedTx);
    });

    const totalReturn = totalValue - totalInvested;
    const returnPercentage = calculateReturn(totalValue, totalInvested);
    const dailyChange = calculateDailyChange(totalValue, 8); // Use average 8%

    return { totalValue, totalInvested, totalReturn, returnPercentage, dailyChange };
  }, [investments, transactions]);

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
    });
    setInvestmentDialogOpen(false);
  };

  const handleCreateContribution = (data: any) => {
    if (!selectedInvestmentId) return;
    
    createTransaction({
      investment_account_id: selectedInvestmentId,
      transaction_date: data.transaction_date.toISOString().split('T')[0],
      type: data.type,
      amount: data.amount,
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

  // Calculate monthly contribution for projections
  const monthlyContribution = useMemo(() => {
    if (!selectedInvestment || investmentTransactions.length === 0) return 0;
    
    const deposits = investmentTransactions.filter(t => t.type === 'deposit');
    if (deposits.length === 0) return 0;
    
    const firstDeposit = new Date(deposits[deposits.length - 1].transaction_date);
    const lastDeposit = new Date(deposits[0].transaction_date);
    const months = Math.max(1, Math.floor(
      (lastDeposit.getTime() - firstDeposit.getTime()) / (1000 * 60 * 60 * 24 * 30)
    ));
    
    const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
    return totalDeposits / months;
  }, [selectedInvestment, investmentTransactions]);

  const currentValue = useMemo(() => {
    if (!selectedInvestment) return 0;
    
    const formattedTx = investmentTransactions.map(tx => ({
      id: tx.id,
      transaction_date: tx.transaction_date,
      type: tx.type as 'deposit' | 'withdrawal' | 'fee' | 'dividend',
      amount: tx.amount,
    }));

    const today = new Date();
    const startDate = new Date(selectedInvestment.start_date);
    const dailyValues = calculateDailyValues(
      formattedTx,
      [],
      startDate,
      today,
      selectedInvestment.expected_annual_return
    );

    return dailyValues.length > 0 ? dailyValues[dailyValues.length - 1].value : 0;
  }, [selectedInvestment, investmentTransactions]);

  const isLoading = isLoadingInvestments || isLoadingTransactions;

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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowChipImportInfo(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Import from Chip
            </Button>
            <Button onClick={() => setInvestmentDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Investment
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold">
                  £{portfolioSummary.totalInvested.toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p className="text-2xl font-bold">
                  £{portfolioSummary.totalValue.toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Return £</p>
                <p className={`text-2xl font-bold ${portfolioSummary.totalReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {portfolioSummary.totalReturn >= 0 ? '+' : '-'}£{Math.abs(portfolioSummary.totalReturn).toLocaleString("en-GB", { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Return %</p>
                <p className={`text-2xl font-bold ${portfolioSummary.returnPercentage >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {portfolioSummary.returnPercentage >= 0 ? '+' : ''}{portfolioSummary.returnPercentage.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Daily Change</p>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-4 w-4 text-success" />
                  <p className="text-2xl font-bold text-success">
                    +£{portfolioSummary.dailyChange.amount.toLocaleString("en-GB", { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })}
                  </p>
                </div>
                <p className="text-xs text-success">+{portfolioSummary.dailyChange.percentage.toFixed(3)}%</p>
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
                  onClick={() => setSelectedInvestmentId(
                    selectedInvestmentId === investment.id ? null : investment.id
                  )}
                  onEdit={() => {
                    // TODO: Edit dialog
                  }}
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
              {/* Performance Chart */}
              <InvestmentPerformanceChart
                transactions={investmentTransactions}
                valuations={valuations}
                startDate={selectedInvestment.start_date}
                expectedAnnualReturn={selectedInvestment.expected_annual_return}
                showProjections={true}
              />

              {/* Projections */}
              <ProjectionCard
                currentValue={currentValue}
                monthlyContribution={monthlyContribution}
                expectedAnnualReturn={selectedInvestment.expected_annual_return}
                onReturnChange={handleExpectedReturnChange}
              />
            </div>

            {/* Contributions */}
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

      {/* Dialogs */}
      <InvestmentFormDialog
        open={investmentDialogOpen}
        onOpenChange={setInvestmentDialogOpen}
        onSubmit={handleCreateInvestment}
        isLoading={isCreating}
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
