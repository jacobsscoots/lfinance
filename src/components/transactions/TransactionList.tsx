import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Transaction } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  // Group transactions by date
  const groupedTransactions = transactions.reduce((groups, transaction) => {
    const date = transaction.transaction_date;
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  );

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date}>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            {format(new Date(date), "EEEE, d MMMM yyyy")}
          </h3>
          <div className="space-y-2">
            {groupedTransactions[date].map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
}

function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const amount = Number(transaction.amount);
  const isIncome = transaction.type === "income";

  return (
    <div className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
            isIncome ? "bg-success/10" : "bg-destructive/10"
          )}
        >
          {isIncome ? (
            <ArrowDownLeft className="h-5 w-5 text-success" />
          ) : (
            <ArrowUpRight className="h-5 w-5 text-destructive" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{transaction.description}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {transaction.merchant && <span>{transaction.merchant}</span>}
            {transaction.category && (
              <Badge
                variant="outline"
                className="text-xs py-0"
                style={{ borderColor: transaction.category.color || undefined }}
              >
                {transaction.category.name}
              </Badge>
            )}
            {transaction.account && (
              <span className="hidden sm:inline">• {transaction.account.name}</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "font-semibold whitespace-nowrap",
            isIncome ? "text-success" : "text-foreground"
          )}
        >
          {isIncome ? "+" : "-"}£{amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(transaction)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(transaction)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
