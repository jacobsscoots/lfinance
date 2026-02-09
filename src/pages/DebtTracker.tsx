import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, CreditCard, Receipt, ArrowRightLeft, FileText, Wallet2 } from "lucide-react";
import { useDebts } from "@/hooks/useDebts";
import { useDebtPayments } from "@/hooks/useDebtPayments";
import { useDebtTransactions } from "@/hooks/useDebtTransactions";
import { useDebtSnapshots } from "@/hooks/useDebtSnapshots";
import { useDebtSettings } from "@/hooks/useDebtSettings";
import { DebtSummaryCards } from "@/components/debt/DebtSummaryCards";
import { DebtAlertsCard } from "@/components/debt/DebtAlertsCard";
import { DebtCharts } from "@/components/debt/DebtCharts";
import { DebtList } from "@/components/debt/DebtList";
import { DebtFormDialog } from "@/components/debt/DebtFormDialog";
import { PaymentList } from "@/components/debt/PaymentList";
import { PaymentFormDialog } from "@/components/debt/PaymentFormDialog";
import { TransactionList } from "@/components/debt/TransactionList";
import { TransactionFormDialog } from "@/components/debt/TransactionFormDialog";
import { TransactionCsvImport } from "@/components/debt/TransactionCsvImport";
import { PayoffPlanCard } from "@/components/debt/PayoffPlanCard";
import { DebtReportsTab } from "@/components/debt/DebtReportsTab";

export default function DebtTracker() {
  const [activeTab, setActiveTab] = useState("overview");
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [selectedDebtId, setSelectedDebtId] = useState<string | undefined>();

  const { debts, isLoading: debtsLoading } = useDebts();
  const { payments, isLoading: paymentsLoading } = useDebtPayments();
  const { transactions, links, isLoading: transactionsLoading } = useDebtTransactions();
  const { snapshots } = useDebtSnapshots();
  const { settings } = useDebtSettings();

  const isLoading = debtsLoading || paymentsLoading || transactionsLoading;

  const handleLogPayment = (debtId?: string) => {
    setSelectedDebtId(debtId);
    setPaymentDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Debt Tracker</h1>
            <p className="text-muted-foreground">
              Track your debts, payments, and plan your path to debt freedom
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setDebtDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Debt
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm">
              <CreditCard className="h-4 w-4 hidden sm:inline" />
              <span className="hidden xs:inline sm:inline">Overview</span>
              <span className="xs:hidden sm:hidden">Home</span>
            </TabsTrigger>
            <TabsTrigger value="debts" className="gap-1.5 text-xs sm:text-sm">
              <Wallet2 className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Debts</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm">
              <Receipt className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5 text-xs sm:text-sm">
              <ArrowRightLeft className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 text-xs sm:text-sm">
              <FileText className="h-4 w-4 sm:hidden" />
              <span className="hidden sm:inline">Reports</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <DebtSummaryCards
              debts={debts}
              payments={payments}
              monthlyBudget={settings?.monthly_budget ?? null}
            />
            
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <DebtCharts
                  debts={debts}
                  payments={payments}
                  snapshots={snapshots}
                />
              </div>
              <div className="space-y-6">
                <DebtAlertsCard
                  debts={debts}
                  payments={payments}
                  settings={settings}
                />
                <div className="flex flex-col gap-2">
                  <Button onClick={() => setDebtDialogOpen(true)} variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Debt
                  </Button>
                  <Button onClick={() => handleLogPayment()} variant="outline" className="w-full">
                    <Receipt className="h-4 w-4 mr-2" />
                    Log Payment
                  </Button>
                  <Button onClick={() => setActiveTab("reports")} variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    Payoff Plan
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Debts Tab */}
          <TabsContent value="debts" className="space-y-4">
            <DebtList
              debts={debts}
              payments={payments}
              isLoading={debtsLoading}
              onAddDebt={() => setDebtDialogOpen(true)}
              onLogPayment={handleLogPayment}
            />
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => handleLogPayment()}>
                <Plus className="h-4 w-4 mr-2" />
                Log Payment
              </Button>
            </div>
            <PaymentList
              payments={payments}
              debts={debts}
              links={links}
              isLoading={paymentsLoading}
            />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-4">
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
                Import CSV
              </Button>
              <Button onClick={() => setTransactionDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Transaction
              </Button>
            </div>
            <TransactionList
              transactions={transactions}
              payments={payments}
              links={links}
              debts={debts}
              isLoading={transactionsLoading}
            />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <DebtReportsTab
              debts={debts}
              payments={payments}
              transactions={transactions}
              links={links}
              settings={settings}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <DebtFormDialog
        open={debtDialogOpen}
        onOpenChange={setDebtDialogOpen}
      />

      <PaymentFormDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        debts={debts}
        preselectedDebtId={selectedDebtId}
      />

      <TransactionFormDialog
        open={transactionDialogOpen}
        onOpenChange={setTransactionDialogOpen}
      />

      <TransactionCsvImport
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
      />
    </AppLayout>
  );
}
