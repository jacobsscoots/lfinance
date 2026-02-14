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
import { useIsMobile } from "@/hooks/use-mobile";

interface CalendarGridProps {
  days: CalendarDay[];
  selectedDate?: Date;
  onSelectDate?: (date: Date) => void;
}

// Full weekday names for desktop, abbreviated for mobile
const weekDaysFull = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekDaysMobile = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarGrid({ days, selectedDate, onSelectDate }: CalendarGridProps) {
  const isMobile = useIsMobile();
  const weekDays = isMobile ? weekDaysMobile : weekDaysFull;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-muted/50">
        {weekDays.map((day, index) => (
          <div
            key={index}
            className="py-2 text-center text-xs sm:text-sm font-medium text-muted-foreground border-b"
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
            isMobile={isMobile}
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
  isMobile: boolean;
}

function CalendarCell({ day, isSelected, onClick, isMobile }: CalendarCellProps) {
  const today = isToday(day.date);
  const maxBills = isMobile ? 2 : 3;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-1 sm:p-2 border-b border-r cursor-pointer transition-colors hover:bg-muted/30 overflow-hidden",
        isMobile ? "min-h-[68px]" : "min-h-[100px]",
        !day.isCurrentMonth && "bg-muted/20 text-muted-foreground",
        isSelected && "bg-primary/10 ring-2 ring-primary ring-inset",
        today && "bg-primary/5"
      )}
    >
      {/* Date number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={cn(
            "text-xs sm:text-sm font-medium",
            today && "bg-primary text-primary-foreground rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs"
          )}
        >
          {format(day.date, "d")}
        </span>
        {day.totalAmount > 0 && day.isCurrentMonth && (
          <span className="text-[10px] sm:text-xs font-semibold text-destructive">
            £{day.totalAmount.toFixed(0)}
          </span>
        )}
      </div>

      {/* Bills */}
      <div className="space-y-0.5 sm:space-y-1">
        {day.bills.slice(0, maxBills).map((bill) => (
          <BillPill key={bill.id} bill={bill} compact={isMobile} />
        ))}
        {day.bills.length > maxBills && (
          <span className="text-[10px] sm:text-xs text-muted-foreground">
            +{day.bills.length - maxBills} more
          </span>
        )}
      </div>
    </div>
  );
}

interface BillPillProps {
  bill: CalendarBill;
  compact?: boolean;
}

function BillPill({ bill, compact = false }: BillPillProps) {
  const getStatusStyle = () => {
    if (bill.isToiletryReorder) {
      if (bill.status === "overdue") return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      return "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-300";
    }
    if (bill.isPaid || bill.status === "paid") {
      return "bg-success/20 text-success line-through";
    }
    if (bill.status === "skipped") {
      return "bg-muted text-muted-foreground line-through";
    }
    if (bill.status === "overdue") {
      return "bg-destructive/20 text-destructive";
    }
    return "bg-destructive/10 text-destructive";
  };

  const getStatusIcon = () => {
    if (bill.isPaid || bill.status === "paid") {
      return <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />;
    }
    return null;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "rounded truncate flex items-center gap-0.5 sm:gap-1 max-w-full",
            compact ? "text-[9px] px-0.5 py-0.5" : "text-xs px-1.5 py-0.5",
            getStatusStyle()
          )}
          style={{
            borderLeft: bill.categoryColor ? `2px solid ${bill.categoryColor}` : undefined,
          }}
        >
          {getStatusIcon()}
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
          {bill.status === "paid" && (
            <p className="text-sm text-success">✓ Paid</p>
          )}
          {bill.status === "skipped" && (
            <p className="text-sm text-muted-foreground">Skipped</p>
          )}
          {bill.status === "overdue" && (
            <p className="text-sm text-destructive">Overdue</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
