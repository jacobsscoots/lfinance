import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar, Repeat, CreditCard, TrendingUp } from "lucide-react";
import { Bill } from "@/hooks/useBills";
import { cn } from "@/lib/utils";

interface BillListItemProps {
  bill: Bill;
  onEdit: (bill: Bill) => void;
  onDelete: (bill: Bill) => void;
}

const frequencyLabels: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  bimonthly: "Every 2 Months",
  quarterly: "Quarterly",
  biannual: "Bi-annual",
  yearly: "Yearly",
};

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

export function BillListItem({ bill, onEdit, onDelete }: BillListItemProps) {
  const amount = Number(bill.amount);
  const isVariable = (bill as any).bill_type === "variable" || (bill as any).is_variable;

  return (
    <div
      className={cn(
        "group flex items-center justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors",
        !bill.is_active && "opacity-60"
      )}
    >
      {/* Left: Name and details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{bill.name}</span>
          {!bill.is_active && (
            <Badge variant="secondary" className="text-xs">Inactive</Badge>
          )}
          {isVariable && (
            <Badge variant="outline" className="text-xs gap-1">
              <TrendingUp className="h-3 w-3" />
              Variable
            </Badge>
          )}
          {bill.category && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{ borderColor: bill.category.color || undefined }}
            >
              {bill.category.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          {bill.provider && <span>{bill.provider}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {bill.due_day}{getOrdinalSuffix(bill.due_day)}
          </span>
          <span className="flex items-center gap-1">
            <Repeat className="h-3 w-3" />
            {frequencyLabels[bill.frequency]}
          </span>
        </div>
      </div>

      {/* Right: Amount and actions */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          {isVariable ? (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span className="text-lg font-semibold">~£{amount.toFixed(2)}</span>
              <span className="text-xs">(est.)</span>
            </div>
          ) : (
            <span className="text-lg font-bold">
              £{amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(bill)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDelete(bill)}
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
