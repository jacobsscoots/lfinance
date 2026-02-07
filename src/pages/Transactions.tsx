import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Receipt, Filter } from "lucide-react";
import { useTransactions, Transaction, TransactionFilters as FilterType } from "@/hooks/useTransactions";
import { TransactionList } from "@/components/transactions/TransactionList";
import { TransactionFilters } from "@/components/transactions/TransactionFilters";
import { TransactionFormDialog } from "@/components/transactions/TransactionFormDialog";
import { DeleteTransactionDialog } from "@/components/transactions/DeleteTransactionDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePaydaySettings } from "@/hooks/usePaydaySettings";
import { getPayCycleForDate, toPaydaySettings } from "@/lib/payCycle";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function Transactions() {
  const { effectiveSettings } = usePaydaySettings();
  
  // Initialize with pay cycle dates
  const [filters, setFilters] = useState<FilterType>(() => {
    const paydaySettings = toPaydaySettings(effectiveSettings);
    const cycle = getPayCycleForDate(new Date(), paydaySettings);
    return {
      dateFrom: cycle.start,
      dateTo: cycle.end,
    };
  });
  
  const { transactions, isLoading } = useTransactions(filters);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isMobile = useIsMobile();

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  
  const totalExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const handleEdit = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setFormOpen(true);
  };

  const handleDelete = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDeleteOpen(true);
  };

  const handleAddNew = () => {
    setSelectedTransaction(null);
    setFormOpen(true);
  };

  const hasActiveFilters = filters.categoryId || filters.type || filters.accountId || filters.search;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground">
              View and manage your transactions
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>

        {/* Mobile: Collapsible Filters */}
        {isMobile ? (
          <div className="space-y-4">
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                      <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </span>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <TransactionFilters filters={filters} onFiltersChange={setFilters} />
              </CollapsibleContent>
            </Collapsible>

            {/* Summary Card */}
            <Card>
              <CardContent className="py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Income</span>
                  <span className="font-semibold text-success">
                    +£{totalIncome.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Expenses</span>
                  <span className="font-semibold text-destructive">
                    -£{totalExpenses.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Net</span>
                    <span
                      className={`font-bold ${
                        totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {totalIncome - totalExpenses >= 0 ? "+" : "-"}£
                      {Math.abs(totalIncome - totalExpenses).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Transaction List */}
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : transactions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No transactions found</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                    {filters.search || filters.categoryId || filters.type
                      ? "Try adjusting your filters to find transactions."
                      : "Add your first transaction to start tracking your finances."}
                  </p>
                  <Button onClick={handleAddNew}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Transaction
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <TransactionList
                transactions={transactions}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            )}
          </div>
        ) : (
          /* Desktop: Side-by-side layout */
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* Filters Sidebar */}
            <div className="space-y-4">
              <TransactionFilters filters={filters} onFiltersChange={setFilters} />
              
              {/* Summary */}
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Income</span>
                    <span className="font-semibold text-success">
                      +£{totalIncome.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Expenses</span>
                    <span className="font-semibold text-destructive">
                      -£{totalExpenses.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Net</span>
                      <span
                        className={`font-bold ${
                          totalIncome - totalExpenses >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {totalIncome - totalExpenses >= 0 ? "+" : "-"}£
                        {Math.abs(totalIncome - totalExpenses).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Transaction List */}
            <div>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                      <Skeleton className="h-5 w-16" />
                    </div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No transactions found</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                      {filters.search || filters.categoryId || filters.type
                        ? "Try adjusting your filters to find transactions."
                        : "Add your first transaction to start tracking your finances."}
                    </p>
                    <Button onClick={handleAddNew}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Transaction
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <TransactionList
                  transactions={transactions}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <TransactionFormDialog open={formOpen} onOpenChange={setFormOpen} transaction={selectedTransaction} />
      <DeleteTransactionDialog open={deleteOpen} onOpenChange={setDeleteOpen} transaction={selectedTransaction} />
    </AppLayout>
  );
}
