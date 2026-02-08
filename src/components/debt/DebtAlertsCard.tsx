import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Debt } from "@/hooks/useDebts";
import { DebtPayment } from "@/hooks/useDebtPayments";
import { DebtSettings } from "@/hooks/useDebtSettings";
import { AlertTriangle, Calendar, Clock, Percent } from "lucide-react";
import { addMonths, differenceInDays, parseISO, isAfter, isBefore, startOfMonth, endOfMonth } from "date-fns";

interface DebtAlertsCardProps {
  debts: Debt[];
  payments: DebtPayment[];
  settings: DebtSettings | null;
}

interface Alert {
  type: 'warning' | 'danger' | 'info';
  icon: React.ReactNode;
  title: string;
  description: string;
  debtId?: string;
}

export function DebtAlertsCard({ debts, payments, settings }: DebtAlertsCardProps) {
  const alerts: Alert[] = [];
  const today = new Date();
  const reminderDays = settings?.reminder_days_before ?? 3;
  const noPaymentThreshold = settings?.no_payment_days_threshold ?? 45;

  const openDebts = debts.filter(d => d.status === 'open');

  for (const debt of openDebts) {
    // Check for upcoming due date
    if (debt.due_day) {
      let dueDate = new Date(today.getFullYear(), today.getMonth(), debt.due_day);
      if (dueDate < today) {
        dueDate = addMonths(dueDate, 1);
      }
      
      const daysUntilDue = differenceInDays(dueDate, today);
      
      // Payment due soon
      if (daysUntilDue >= 0 && daysUntilDue <= reminderDays) {
        alerts.push({
          type: 'warning',
          icon: <Calendar className="h-4 w-4" />,
          title: `${debt.creditor_name} due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`}`,
          description: debt.min_payment ? `Min payment: £${debt.min_payment}` : 'Check minimum payment',
          debtId: debt.id,
        });
      }
      
      // Check if overdue (past due day this month with no payment)
      const thisMonthStart = startOfMonth(today);
      const thisMonthEnd = endOfMonth(today);
      const thisMonthDueDate = new Date(today.getFullYear(), today.getMonth(), debt.due_day);
      
      if (isAfter(today, thisMonthDueDate)) {
        const hasPaymentThisMonth = payments.some(p => {
          const paymentDate = parseISO(p.payment_date);
          return p.debt_id === debt.id && 
                 paymentDate >= thisMonthStart && 
                 paymentDate <= thisMonthEnd &&
                 p.category !== 'fee';
        });
        
        if (!hasPaymentThisMonth) {
          alerts.push({
            type: 'danger',
            icon: <AlertTriangle className="h-4 w-4" />,
            title: `${debt.creditor_name} payment overdue`,
            description: 'No payment logged this month',
            debtId: debt.id,
          });
        }
      }
    }

    // Check for promo ending
    if (debt.promo_end_date) {
      const promoEnd = parseISO(debt.promo_end_date);
      const daysUntilPromoEnd = differenceInDays(promoEnd, today);
      
      if (daysUntilPromoEnd > 0 && daysUntilPromoEnd <= 30) {
        alerts.push({
          type: 'warning',
          icon: <Percent className="h-4 w-4" />,
          title: `0% promo ends in ${daysUntilPromoEnd} days`,
          description: `${debt.creditor_name} - plan ahead`,
          debtId: debt.id,
        });
      } else if (daysUntilPromoEnd <= 0 && daysUntilPromoEnd > -7) {
        alerts.push({
          type: 'danger',
          icon: <Percent className="h-4 w-4" />,
          title: `0% promo ended`,
          description: `${debt.creditor_name} - interest now applies`,
          debtId: debt.id,
        });
      }
    }

    // Check for no recent payment
    const debtPayments = payments.filter(p => p.debt_id === debt.id && p.category !== 'fee');
    if (debtPayments.length > 0) {
      const lastPayment = debtPayments.reduce((latest, p) => {
        const date = parseISO(p.payment_date);
        return !latest || date > latest ? date : latest;
      }, null as Date | null);
      
      if (lastPayment) {
        const daysSincePayment = differenceInDays(today, lastPayment);
        if (daysSincePayment > noPaymentThreshold) {
          alerts.push({
            type: 'info',
            icon: <Clock className="h-4 w-4" />,
            title: `No payment in ${daysSincePayment} days`,
            description: debt.creditor_name,
            debtId: debt.id,
          });
        }
      }
    } else if (debt.opened_date) {
      const openedDate = parseISO(debt.opened_date);
      const daysSinceOpened = differenceInDays(today, openedDate);
      if (daysSinceOpened > noPaymentThreshold) {
        alerts.push({
          type: 'info',
          icon: <Clock className="h-4 w-4" />,
          title: `No payments logged yet`,
          description: debt.creditor_name,
          debtId: debt.id,
        });
      }
    }
  }

  // Sort alerts: danger first, then warning, then info
  const sortedAlerts = alerts.sort((a, b) => {
    const order = { danger: 0, warning: 1, info: 2 };
    return order[a.type] - order[b.type];
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Alerts
          {sortedAlerts.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {sortedAlerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sortedAlerts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No alerts — you're on track! 🎉
          </p>
        ) : (
          sortedAlerts.slice(0, 5).map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 p-3 rounded-lg ${
                alert.type === 'danger' 
                  ? 'bg-destructive/10 text-destructive' 
                  : alert.type === 'warning'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <div className="mt-0.5">{alert.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{alert.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{alert.description}</p>
              </div>
            </div>
          ))
        )}
        {sortedAlerts.length > 5 && (
          <p className="text-xs text-muted-foreground text-center">
            +{sortedAlerts.length - 5} more alerts
          </p>
        )}
      </CardContent>
    </Card>
  );
}
