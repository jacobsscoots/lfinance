import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, AlertTriangle, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/dashboardCalculations";

interface OutgoingsItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  accountName: string;
  isBillLinked: boolean;
  isTransferExcluded: boolean;
  isDuplicate: boolean;
}

interface OutgoingsBreakdownProps {
  items: OutgoingsItem[];
  totalSpent: number;
  isLoading?: boolean;
}

export function OutgoingsBreakdown({ items, totalSpent, isLoading }: OutgoingsBreakdownProps) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading || items.length === 0) return null;

  const includedItems = items.filter(i => !i.isTransferExcluded && !i.isDuplicate);
  const excludedItems = items.filter(i => i.isTransferExcluded || i.isDuplicate);
  const includedTotal = includedItems.reduce((s, i) => s + i.amount, 0);
  const excludedTotal = excludedItems.reduce((s, i) => s + i.amount, 0);

  const displayItems = expanded ? includedItems : includedItems.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Outgoings Breakdown</CardTitle>
          <span className="text-sm font-semibold">{formatCurrency(totalSpent)}</span>
        </div>
        {excludedItems.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {excludedItems.length} internal transfer{excludedItems.length > 1 ? "s" : ""} / duplicate{excludedItems.length > 1 ? "s" : ""} excluded ({formatCurrency(excludedTotal)})
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        {displayItems.map(item => (
          <div key={item.id} className="flex items-center justify-between py-1.5 text-sm border-b border-border/30 last:border-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="truncate font-medium">{item.description}</span>
              {item.isBillLinked && (
                <Badge variant="outline" className="text-[10px] shrink-0">Bill</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs text-muted-foreground">{item.date}</span>
              <span className="font-medium w-20 text-right">{formatCurrency(item.amount)}</span>
            </div>
          </div>
        ))}

        {includedItems.length > 10 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>Show less <ChevronUp className="h-3 w-3 ml-1" /></>
            ) : (
              <>Show all {includedItems.length} transactions <ChevronDown className="h-3 w-3 ml-1" /></>
            )}
          </Button>
        )}

        {/* Excluded items section */}
        {excludedItems.length > 0 && expanded && (
          <div className="mt-3 pt-3 border-t space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3" />
              Excluded (transfers & duplicates)
            </p>
            {excludedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1 text-sm opacity-50">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="truncate">{item.description}</span>
                  {item.isTransferExcluded && (
                    <Badge variant="outline" className="text-[9px]">Transfer</Badge>
                  )}
                  {item.isDuplicate && (
                    <Badge variant="outline" className="text-[9px]">Duplicate</Badge>
                  )}
                </div>
                <span className="font-medium w-20 text-right shrink-0 line-through">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
