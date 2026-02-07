import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreVertical, 
  Trash2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Percent, 
  Coins,
  RefreshCw
} from "lucide-react";
import { InvestmentTransaction } from "@/hooks/useInvestmentTransactions";
import { cn } from "@/lib/utils";

interface ContributionListProps {
  transactions: InvestmentTransaction[];
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const typeConfig = {
  deposit: { icon: ArrowDownLeft, color: "text-success", bg: "bg-success/10", label: "Deposit" },
  withdrawal: { icon: ArrowUpRight, color: "text-destructive", bg: "bg-destructive/10", label: "Withdrawal" },
  fee: { icon: Percent, color: "text-amber-500", bg: "bg-amber-500/10", label: "Fee" },
  dividend: { icon: Coins, color: "text-blue-500", bg: "bg-blue-500/10", label: "Dividend" },
};

export function ContributionList({ transactions, onDelete, isDeleting }: ContributionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No contributions yet</p>
        <p className="text-sm">Add your first contribution to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => {
        const config = typeConfig[tx.type as keyof typeof typeConfig] || typeConfig.deposit;
        const Icon = config.icon;
        const isInflow = tx.type === "deposit" || tx.type === "dividend";
        
        return (
          <div
            key={tx.id}
            className="group flex items-center justify-between p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className={cn("h-9 w-9 rounded-full flex items-center justify-center", config.bg)}>
                <Icon className={cn("h-4 w-4", config.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{config.label}</p>
                  {tx.is_recurring && (
                    <Badge variant="secondary" className="text-xs py-0 gap-1">
                      <RefreshCw className="h-3 w-3" />
                      {tx.recurring_frequency}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(tx.transaction_date), "d MMM yyyy")}</span>
                  {tx.notes && <span className="truncate">• {tx.notes}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "font-semibold whitespace-nowrap text-sm sm:text-base",
                  isInflow ? "text-success" : "text-foreground"
                )}
              >
                {isInflow ? "+" : "-"}£{Math.abs(tx.amount).toLocaleString("en-GB", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity h-8 w-8"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => onDelete(tx.id)}
                    className="text-destructive focus:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        );
      })}
    </div>
  );
}
