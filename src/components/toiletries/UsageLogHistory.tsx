import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { useToiletryUsageLogs } from "@/hooks/useToiletryUsageLogs";
import { calculateDailyUsageFromLogs } from "@/lib/reorderCalculations";
import { Badge } from "@/components/ui/badge";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

interface UsageLogHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ToiletryItem | null;
}

export function UsageLogHistory({ open, onOpenChange, item }: UsageLogHistoryProps) {
  const { logs, deleteLog } = useToiletryUsageLogs(item?.id);

  if (!item) return null;

  const usageRate = calculateDailyUsageFromLogs(
    logs.map((l) => ({ logged_date: l.logged_date, amount_used: l.amount_used }))
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Usage History — {item.name}</DialogTitle>
        </DialogHeader>

        {usageRate.dailyUsage !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Estimated daily usage:</span>
            <span className="font-medium">
              {usageRate.dailyUsage} {item.size_unit}/day
            </span>
            <Badge variant="outline" className="text-xs">
              {usageRate.confidence}
            </Badge>
          </div>
        )}

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No usage logged yet. Use the quick log to start tracking.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {format(new Date(log.logged_date), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.amount_used} {item.size_unit}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {log.notes || "—"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => deleteLog.mutate(log.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
