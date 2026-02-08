import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DebtTransaction, PaymentTransactionLink } from "@/hooks/useDebtTransactions";
import { DebtPaymentWithDebt } from "@/hooks/useDebtPayments";
import { Debt } from "@/hooks/useDebts";
import { format, parseISO, differenceInDays } from "date-fns";
import { ArrowRightLeft, Calendar, Search, Check, AlertCircle, X, Link2, Unlink } from "lucide-react";
import { TransactionMatcher } from "./TransactionMatcher";

interface TransactionListProps {
  transactions: DebtTransaction[];
  payments: DebtPaymentWithDebt[];
  links: PaymentTransactionLink[];
  debts: Debt[];
  isLoading: boolean;
}

type MatchStatus = 'all' | 'matched' | 'needs-review' | 'unmatched';

export function TransactionList({ 
  transactions, 
  payments, 
  links, 
  debts,
  isLoading 
}: TransactionListProps) {
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<DebtTransaction | null>(null);

  const isTransactionLinked = (txId: string) => {
    return links.some(l => l.transaction_id === txId);
  };

  const getLinkedPaymentId = (txId: string) => {
    const link = links.find(l => l.transaction_id === txId);
    return link?.payment_id;
  };

  const getSuggestedMatches = (tx: DebtTransaction) => {
    // Find payments that could match this transaction
    return payments.filter(p => {
      // Amount match (within £0.01)
      const amountMatch = Math.abs(Number(p.amount) - Number(tx.amount)) < 0.01;
      
      // Date match (within 3 days)
      const txDate = parseISO(tx.transaction_date);
      const paymentDate = parseISO(p.payment_date);
      const dateMatch = Math.abs(differenceInDays(txDate, paymentDate)) <= 3;
      
      // Keyword match (creditor name in description)
      const debt = debts.find(d => d.id === p.debt_id);
      const keywordMatch = debt && tx.description.toLowerCase().includes(debt.creditor_name.toLowerCase());
      
      return amountMatch && (dateMatch || keywordMatch);
    });
  };

  const getTransactionStatus = (tx: DebtTransaction): 'matched' | 'needs-review' | 'unmatched' => {
    if (isTransactionLinked(tx.id)) return 'matched';
    if (getSuggestedMatches(tx).length > 0) return 'needs-review';
    return 'unmatched';
  };

  // Filter transactions
  let filteredTransactions = transactions.filter(tx => {
    const status = getTransactionStatus(tx);
    if (matchStatus !== 'all' && status !== matchStatus) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!tx.description.toLowerCase().includes(query) && 
          !(tx.reference?.toLowerCase().includes(query))) {
        return false;
      }
    }
    
    return true;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const getStatusBadge = (status: 'matched' | 'needs-review' | 'unmatched') => {
    switch (status) {
      case 'matched':
        return (
          <Badge variant="default" className="gap-1 bg-green-500/10 text-green-600 hover:bg-green-500/20">
            <Check className="h-3 w-3" />
            Matched
          </Badge>
        );
      case 'needs-review':
        return (
          <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20">
            <AlertCircle className="h-3 w-3" />
            Review
          </Badge>
        );
      case 'unmatched':
        return (
          <Badge variant="outline" className="gap-1">
            <X className="h-3 w-3" />
            Unmatched
          </Badge>
        );
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
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          {(['all', 'matched', 'needs-review', 'unmatched'] as MatchStatus[]).map(status => (
            <Button
              key={status}
              variant={matchStatus === status ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMatchStatus(status)}
            >
              {status === 'all' ? 'All' : 
               status === 'matched' ? 'Matched' :
               status === 'needs-review' ? 'Review' : 'Unmatched'}
            </Button>
          ))}
        </div>
      </div>

      {/* Transactions List */}
      {filteredTransactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
            <p className="text-muted-foreground text-center">
              {transactions.length === 0 
                ? "Add transactions manually or import from CSV."
                : "No transactions match your filters."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTransactions.map(tx => {
            const status = getTransactionStatus(tx);
            const suggestedCount = getSuggestedMatches(tx).length;
            
            return (
              <Card 
                key={tx.id} 
                className="hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => setSelectedTransaction(tx)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(tx.transaction_date), 'dd MMM yyyy')}
                          {tx.reference && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[120px]">Ref: {tx.reference}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {getStatusBadge(status)}
                      {status === 'needs-review' && suggestedCount > 0 && (
                        <Badge variant="outline">
                          {suggestedCount} match{suggestedCount > 1 ? 'es' : ''}
                        </Badge>
                      )}
                      <p className="font-semibold text-foreground">
                        {formatCurrency(Number(tx.amount))}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Transaction Matcher Dialog */}
      <TransactionMatcher
        open={!!selectedTransaction}
        onOpenChange={(open) => !open && setSelectedTransaction(null)}
        transaction={selectedTransaction}
        payments={payments}
        links={links}
        debts={debts}
      />
    </div>
  );
}
