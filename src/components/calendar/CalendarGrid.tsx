import { format, isToday, isSameDay } from "date-fns";
import { CalendarDay, CalendarBill } from "@/hooks/useCalendarData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CalendarGridProps {
  days: CalendarDay[];
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
}

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarGrid({ days, selectedDate, onSelectDate }: CalendarGridProps) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-muted/50">
        {weekDays.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-sm font-medium text-muted-foreground border-b"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar days */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => (
          <CalendarCell
            key={index}
            day={day}
            isSelected={selectedDate ? isSameDay(day.date, selectedDate) : false}
            onClick={() => onSelectDate?.(day.date)}
          />
        ))}
      </div>
    </div>
  );
}

interface CalendarCellProps {
  day: CalendarDay;
  isSelected: boolean;
  onClick: () => void;
}

function CalendarCell({ day, isSelected, onClick }: CalendarCellProps) {
  const today = isToday(day.date);
  const hasBills = day.bills.length > 0;

  return (
    <div
      onClick={onClick}
      className={cn(
        "min-h-[100px] p-2 border-b border-r cursor-pointer transition-colors hover:bg-muted/30",
        !day.isCurrentMonth && "bg-muted/20 text-muted-foreground",
        isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
        today && "bg-primary/5"
      )}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-sm font-medium",
            today && "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center"
          )}
        >
          {format(day.date, "d")}
        </span>
        {day.totalAmount > 0 && day.isCurrentMonth && (
          <span className="text-xs font-semibold text-destructive">
            £{day.totalAmount.toFixed(0)}
          </span>
        )}
      </div>

      {/* Bills */}
      <div className="space-y-1">
        {day.bills.slice(0, 3).map((bill) => (
          <BillPill key={bill.id} bill={bill} />
        ))}
        {day.bills.length > 3 && (
          <span className="text-xs text-muted-foreground">
            +{day.bills.length - 3} more
          </span>
        )}
      </div>
    </div>
  );
}

interface BillPillProps {
  bill: CalendarBill;
}

function BillPill({ bill }: BillPillProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "text-xs px-1.5 py-0.5 rounded truncate flex items-center gap-1",
            bill.isPaid
              ? "bg-success/20 text-success line-through"
              : "bg-destructive/10 text-destructive"
          )}
          style={{
            borderLeft: bill.categoryColor ? `3px solid ${bill.categoryColor}` : undefined,
          }}
        >
          {bill.isPaid && <Check className="h-3 w-3 shrink-0" />}
          <span className="truncate">{bill.name}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <p className="font-medium">{bill.name}</p>
          <p className="text-sm">£{bill.amount.toFixed(2)} • {bill.frequency}</p>
          {bill.categoryName && (
            <Badge variant="outline" className="text-xs">
              {bill.categoryName}
            </Badge>
          )}
          {bill.isPaid && (
            <p className="text-sm text-success">✓ Paid</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
