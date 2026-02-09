import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Calendar, Repeat } from "lucide-react";
import { Bill } from "@/hooks/useBills";
import { cn } from "@/lib/utils";

interface BillCardProps {
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

export function BillCard({ bill, onEdit, onDelete }: BillCardProps) {
  const amount = Number(bill.amount);

  return (
    <Card className={cn("group hover:shadow-md transition-shadow", !bill.is_active && "opacity-60")}>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-base font-medium flex items-center gap-2 flex-wrap">
            <span className="truncate">{bill.name}</span>
            {!bill.is_active && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {bill.provider && <span>{bill.provider}</span>}
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
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Due: {bill.due_day}{getOrdinalSuffix(bill.due_day)} of month</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Repeat className="h-4 w-4" />
              <span>{frequencyLabels[bill.frequency]}</span>
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">
            £{amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}
