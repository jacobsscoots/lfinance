import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { useToiletryUsageLogs, type UsageLog } from "@/hooks/useToiletryUsageLogs";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

interface QuickUsageLogProps {
  item: ToiletryItem;
}

export function QuickUsageLog({ item }: QuickUsageLogProps) {
  const { logs, logUsage, deleteLog } = useToiletryUsageLogs(item.id);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleLog = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    logUsage.mutate({
      toiletry_item_id: item.id,
      logged_date: date,
      amount_used: val,
    });
    setAmount("");
  };

  const recentLogs = logs.slice(0, 3);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Amount ({item.size_unit})</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="h-8"
          />
        </div>
        <div className="flex-1">
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8"
          />
        </div>
        <Button
          size="sm"
          className="h-8"
          onClick={handleLog}
          disabled={logUsage.isPending || !amount}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {recentLogs.length > 0 && (
        <div className="space-y-1">
          {recentLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-center justify-between text-xs text-muted-foreground"
            >
              <span>
                {format(new Date(log.logged_date), "d MMM")} — {log.amount_used}
                {item.size_unit}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => deleteLog.mutate(log.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
