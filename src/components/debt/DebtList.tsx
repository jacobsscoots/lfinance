import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Debt } from "@/hooks/useDebts";
import { DebtPayment } from "@/hooks/useDebtPayments";
import { calculateDebtProgress, getDebtTypeLabel } from "@/lib/debtCalculations";
import { Plus, CreditCard, Building2, Wallet, ShoppingBag, MoreHorizontal, Edit, Trash2, Receipt, Link } from "lucide-react";
import { DebtFormDialog } from "./DebtFormDialog";
import { DeleteDebtDialog } from "./DeleteDebtDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DebtListProps {
  debts: Debt[];
  payments: DebtPayment[];
  isLoading: boolean;
  onAddDebt: () => void;
  onLogPayment: (debtId: string) => void;
}

type StatusFilter = 'all' | 'open' | 'closed';
type TypeFilter = 'all' | 'credit_card' | 'loan' | 'overdraft' | 'bnpl' | 'other';
type SortBy = 'name' | 'balance' | 'apr' | 'due';

const debtTypeIcons: Record<string, React.ReactNode> = {
  credit_card: <CreditCard className="h-5 w-5" />,
  loan: <Building2 className="h-5 w-5" />,
  overdraft: <Wallet className="h-5 w-5" />,
  bnpl: <ShoppingBag className="h-5 w-5" />,
  other: <Wallet className="h-5 w-5" />,
};

export function DebtList({ debts, payments, isLoading, onAddDebt, onLogPayment }: DebtListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('balance');
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [deleteDebt, setDeleteDebt] = useState<Debt | null>(null);

  // Filter debts
  let filteredDebts = debts.filter(d => {
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (typeFilter !== 'all' && d.debt_type !== typeFilter) return false;
    return true;
  });

  // Sort debts
  filteredDebts = [...filteredDebts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.creditor_name.localeCompare(b.creditor_name);
      case 'balance':
        return Number(b.current_balance) - Number(a.current_balance);
      case 'apr':
        return (Number(b.apr) || 0) - (Number(a.apr) || 0);
      case 'due':
        return (a.due_day || 32) - (b.due_day || 32);
      default:
        return 0;
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
              <SelectItem value="overdraft">Overdraft</SelectItem>
              <SelectItem value="bnpl">BNPL</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="balance">Highest Balance</SelectItem>
              <SelectItem value="apr">Highest APR</SelectItem>
              <SelectItem value="due">Next Due</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={onAddDebt}>
          <Plus className="h-4 w-4 mr-2" />
          Add Debt
        </Button>
      </div>

      {/* Debt Cards */}
      {filteredDebts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No debts found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {statusFilter === 'open' 
                ? "You don't have any open debts. Great job!"
                : "No debts match your filters."
              }
            </p>
            <Button onClick={onAddDebt}>
              <Plus className="h-4 w-4 mr-2" />
              Add Debt
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map(debt => {
            const progress = calculateDebtProgress(debt);
            const debtPayments = payments.filter(p => p.debt_id === debt.id);
            
            return (
              <Card key={debt.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {debtTypeIcons[debt.debt_type] || <Wallet className="h-5 w-5" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-foreground">{debt.creditor_name}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {getDebtTypeLabel(debt.debt_type)}
                            </Badge>
                            {debt.status === 'closed' && (
                              <Badge variant="outline" className="text-xs">Closed</Badge>
                            )}
                            {debt.linked_account_id && (
                              <Badge variant="outline" className="text-xs gap-1 border-primary/50 text-primary">
                                <Link className="h-3 w-3" />
                                Auto-sync
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(Number(debt.current_balance))} / {formatCurrency(Number(debt.starting_balance))}
                            {debt.apr && <span className="ml-2">• {debt.apr}% APR</span>}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onLogPayment(debt.id)}>
                              <Receipt className="h-4 w-4 mr-2" />
                              Log Payment
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditDebt(debt)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => setDeleteDebt(debt)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <Progress value={progress} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{progress.toFixed(1)}% paid</span>
                          <span>
                            {debt.min_payment && `£${debt.min_payment} min`}
                            {debt.due_day && ` • Due: ${debt.due_day}${getOrdinalSuffix(debt.due_day)}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <DebtFormDialog
        open={!!editDebt}
        onOpenChange={(open) => !open && setEditDebt(null)}
        debt={editDebt || undefined}
      />

      {/* Delete Dialog */}
      <DeleteDebtDialog
        open={!!deleteDebt}
        onOpenChange={(open) => !open && setDeleteDebt(null)}
        debt={deleteDebt || undefined}
      />
    </div>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}
