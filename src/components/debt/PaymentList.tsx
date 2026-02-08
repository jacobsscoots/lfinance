import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { DebtPaymentWithDebt } from "@/hooks/useDebtPayments";
import { PaymentTransactionLink } from "@/hooks/useDebtTransactions";
import { Debt } from "@/hooks/useDebts";
import { getPaymentCategoryLabel } from "@/lib/debtCalculations";
import { format, parseISO } from "date-fns";
import { Receipt, Link2, Calendar, Search, FileText } from "lucide-react";

interface PaymentListProps {
  payments: DebtPaymentWithDebt[];
  debts: Debt[];
  links: PaymentTransactionLink[];
  isLoading: boolean;
}

type CategoryFilter = 'all' | 'normal' | 'extra' | 'fee' | 'refund' | 'adjustment';
type MatchedFilter = 'all' | 'matched' | 'unmatched';

export function PaymentList({ payments, debts, links, isLoading }: PaymentListProps) {
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [debtFilter, setDebtFilter] = useState<string>('all');
  const [matchedFilter, setMatchedFilter] = useState<MatchedFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const getLinkedTransactionCount = (paymentId: string) => {
    return links.filter(l => l.payment_id === paymentId).length;
  };

  // Filter payments
  let filteredPayments = payments.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (debtFilter !== 'all' && p.debt_id !== debtFilter) return false;
    
    const isMatched = getLinkedTransactionCount(p.id) > 0;
    if (matchedFilter === 'matched' && !isMatched) return false;
    if (matchedFilter === 'unmatched' && isMatched) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const debtName = p.debts?.creditor_name?.toLowerCase() || '';
      const notes = p.notes?.toLowerCase() || '';
      if (!debtName.includes(query) && !notes.includes(query)) return false;
    }
    
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getCategoryVariant = (category: string) => {
    switch (category) {
      case 'extra': return 'default';
      case 'fee': return 'destructive';
      case 'refund': return 'secondary';
      case 'adjustment': return 'outline';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search payments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={debtFilter} onValueChange={setDebtFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Debts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Debts</SelectItem>
            {debts.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.creditor_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="extra">Extra</SelectItem>
            <SelectItem value="fee">Fee</SelectItem>
            <SelectItem value="refund">Refund</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>

        <Select value={matchedFilter} onValueChange={(v) => setMatchedFilter(v as MatchedFilter)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Matched" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="unmatched">Unmatched</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payments List */}
      {filteredPayments.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No payments found</h3>
            <p className="text-muted-foreground text-center">
              {payments.length === 0 
                ? "Log your first payment to start tracking."
                : "No payments match your filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredPayments.map(payment => {
            const linkedCount = getLinkedTransactionCount(payment.id);
            const isMatched = linkedCount > 0;
            
            return (
              <Card key={payment.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">
                            {payment.debts?.creditor_name || 'Unknown'}
                          </span>
                          <Badge variant={getCategoryVariant(payment.category)}>
                            {getPaymentCategoryLabel(payment.category)}
                          </Badge>
                          {isMatched && (
                            <Badge variant="outline" className="gap-1">
                              <Link2 className="h-3 w-3" />
                              {linkedCount}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(payment.payment_date), 'dd MMM yyyy')}
                          {payment.notes && (
                            <>
                              <span>•</span>
                              <FileText className="h-3 w-3" />
                              <span className="truncate max-w-[150px]">{payment.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`font-semibold ${
                        payment.category === 'fee' ? 'text-destructive' : 
                        payment.category === 'refund' ? 'text-amber-600' : 
                        'text-foreground'
                      }`}>
                        {payment.category === 'fee' ? '+' : payment.category === 'refund' ? '+' : '-'}
                        {formatCurrency(Number(payment.amount))}
                      </p>
                      {(payment.principal_amount || payment.interest_amount) && (
                        <p className="text-xs text-muted-foreground">
                          {payment.principal_amount && `P: £${payment.principal_amount}`}
                          {payment.interest_amount && ` I: £${payment.interest_amount}`}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
