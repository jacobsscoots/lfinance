import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DebtTransaction, useDebtTransactions, PaymentTransactionLink } from "@/hooks/useDebtTransactions";
import { DebtPaymentWithDebt } from "@/hooks/useDebtPayments";
import { Debt } from "@/hooks/useDebts";
import { format, parseISO, differenceInDays } from "date-fns";
import { Link2, Unlink, Check, Calendar, Receipt } from "lucide-react";

interface TransactionMatcherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: DebtTransaction | null;
  payments: DebtPaymentWithDebt[];
  links: PaymentTransactionLink[];
  debts: Debt[];
}

export function TransactionMatcher({
  open,
  onOpenChange,
  transaction,
  payments,
  links,
  debts,
}: TransactionMatcherProps) {
  const { linkTransaction, unlinkTransaction } = useDebtTransactions();

  if (!transaction) return null;

  const linkedPaymentIds = links
    .filter(l => l.transaction_id === transaction.id)
    .map(l => l.payment_id);

  const isLinkedTo = (paymentId: string) => linkedPaymentIds.includes(paymentId);

  const getSuggestedPayments = () => {
    return payments.filter(p => {
      // Amount match (within £0.01)
      const amountMatch = Math.abs(Number(p.amount) - Number(transaction.amount)) < 0.01;
      
      // Date match (within 3 days)
      const txDate = parseISO(transaction.transaction_date);
      const paymentDate = parseISO(p.payment_date);
      const dateMatch = Math.abs(differenceInDays(txDate, paymentDate)) <= 3;
      
      // Keyword match
      const debt = debts.find(d => d.id === p.debt_id);
      const keywordMatch = debt && transaction.description.toLowerCase().includes(debt.creditor_name.toLowerCase());
      
      return amountMatch && (dateMatch || keywordMatch);
    });
  };

  const suggestedPayments = getSuggestedPayments();
  const otherPayments = payments.filter(p => !suggestedPayments.some(sp => sp.id === p.id));

  const handleToggleLink = async (paymentId: string) => {
    if (isLinkedTo(paymentId)) {
      await unlinkTransaction.mutateAsync({ 
        paymentId, 
        transactionId: transaction.id 
      });
    } else {
      await linkTransaction.mutateAsync({ 
        paymentId, 
        transactionId: transaction.id 
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Match Transaction</DialogTitle>
        </DialogHeader>

        {/* Transaction Details */}
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <p className="font-medium">{transaction.description}</p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseISO(transaction.transaction_date), 'dd MMM yyyy')}
              </span>
              <span className="font-semibold text-foreground">
                {formatCurrency(Number(transaction.amount))}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Linked Payments */}
        {linkedPaymentIds.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Check className="h-4 w-4 text-green-500" />
              Linked Payments
            </h4>
            {payments.filter(p => linkedPaymentIds.includes(p.id)).map(payment => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                isLinked={true}
                onToggle={() => handleToggleLink(payment.id)}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        )}

        {/* Suggested Matches */}
        {suggestedPayments.filter(p => !linkedPaymentIds.includes(p.id)).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Suggested Matches</h4>
            {suggestedPayments
              .filter(p => !linkedPaymentIds.includes(p.id))
              .map(payment => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  isLinked={false}
                  isSuggested={true}
                  onToggle={() => handleToggleLink(payment.id)}
                  formatCurrency={formatCurrency}
                />
              ))}
          </div>
        )}

        {/* Other Payments */}
        {otherPayments.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Other Payments</h4>
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {otherPayments
                .filter(p => !linkedPaymentIds.includes(p.id))
                .slice(0, 10)
                .map(payment => (
                  <PaymentCard
                    key={payment.id}
                    payment={payment}
                    isLinked={false}
                    onToggle={() => handleToggleLink(payment.id)}
                    formatCurrency={formatCurrency}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface PaymentCardProps {
  payment: DebtPaymentWithDebt;
  isLinked: boolean;
  isSuggested?: boolean;
  onToggle: () => void;
  formatCurrency: (amount: number) => string;
}

function PaymentCard({ payment, isLinked, isSuggested, onToggle, formatCurrency }: PaymentCardProps) {
  return (
    <Card className={`${isLinked ? 'border-green-500/50 bg-green-500/5' : isSuggested ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
            <Receipt className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {payment.debts?.creditor_name || 'Unknown'}
            </p>
            <p className="text-xs text-muted-foreground">
              {format(parseISO(payment.payment_date), 'dd MMM yyyy')} • {formatCurrency(Number(payment.amount))}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant={isLinked ? 'default' : 'outline'}
          onClick={onToggle}
        >
          {isLinked ? (
            <>
              <Unlink className="h-3 w-3 mr-1" />
              Unlink
            </>
          ) : (
            <>
              <Link2 className="h-3 w-3 mr-1" />
              Link
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
