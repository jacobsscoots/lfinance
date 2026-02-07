import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth,
  isSameDay,
  addMonths,
  format,
  getDay,
  isBefore,
  isAfter,
} from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Bill = Tables<"bills"> & {
  category?: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
};

export interface CalendarBill {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  frequency: string;
  categoryName?: string;
  categoryColor?: string | null;
  isPaid?: boolean;
  status?: "due" | "paid" | "overdue" | "skipped";
  matchConfidence?: string;
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  bills: CalendarBill[];
  totalAmount: number;
}

// Calculate all bill occurrences for a given month
function getBillOccurrencesForMonth(bill: Bill, monthStart: Date, monthEnd: Date): Date[] {
  const occurrences: Date[] = [];
  const month = monthStart.getMonth();
  const year = monthStart.getFullYear();
  
  // Check if bill is active for this period
  if (bill.start_date && isAfter(monthStart, new Date(bill.end_date || '2099-12-31'))) {
    return occurrences;
  }
  if (bill.end_date && isBefore(monthEnd, new Date(bill.start_date || '1900-01-01'))) {
    return occurrences;
  }

  switch (bill.frequency) {
    case 'monthly':
      // One occurrence on the due day
      const monthlyDate = new Date(year, month, Math.min(bill.due_day, new Date(year, month + 1, 0).getDate()));
      if (monthlyDate >= monthStart && monthlyDate <= monthEnd) {
        occurrences.push(monthlyDate);
      }
      break;
      
    case 'weekly':
      // Every week, starting from due_day as day of week (1-7 = Mon-Sun, but we use 1-31 for day of month)
      // For weekly, we'll use due_day as the day of the month for the first occurrence
      let weeklyDate = new Date(year, month, 1);
      while (weeklyDate <= monthEnd) {
        if (weeklyDate >= monthStart && weeklyDate.getDate() % 7 === bill.due_day % 7) {
          occurrences.push(new Date(weeklyDate));
        }
        weeklyDate.setDate(weeklyDate.getDate() + 1);
      }
      // Simplified: just show on the due day for weekly
      const firstWeekly = new Date(year, month, Math.min(bill.due_day, new Date(year, month + 1, 0).getDate()));
      if (firstWeekly >= monthStart && firstWeekly <= monthEnd && occurrences.length === 0) {
        occurrences.push(firstWeekly);
      }
      break;
      
    case 'fortnightly':
      // Every two weeks
      const fortnightlyDate = new Date(year, month, Math.min(bill.due_day, new Date(year, month + 1, 0).getDate()));
      if (fortnightlyDate >= monthStart && fortnightlyDate <= monthEnd) {
        occurrences.push(fortnightlyDate);
      }
      break;
      
    case 'quarterly':
      // Every 3 months - check if this month is a quarter month
      if (month % 3 === 0) {
        const quarterlyDate = new Date(year, month, Math.min(bill.due_day, new Date(year, month + 1, 0).getDate()));
        if (quarterlyDate >= monthStart && quarterlyDate <= monthEnd) {
          occurrences.push(quarterlyDate);
        }
      }
      break;
      
    case 'yearly':
      // Once a year - for simplicity, show in January or on the bill's start month
      const startMonth = bill.start_date ? new Date(bill.start_date).getMonth() : 0;
      if (month === startMonth) {
        const yearlyDate = new Date(year, month, Math.min(bill.due_day, new Date(year, month + 1, 0).getDate()));
        if (yearlyDate >= monthStart && yearlyDate <= monthEnd) {
          occurrences.push(yearlyDate);
        }
      }
      break;
  }
  
  return occurrences;
}

export function useCalendarData(currentDate: Date) {
  const { user } = useAuth();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  
  // Get the first day of the week (Monday) before or on monthStart
  const startDayOfWeek = getDay(monthStart);
  // Adjust for Monday start (getDay returns 0 for Sunday)
  const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(calendarStart.getDate() - daysToSubtract);
  
  // Get the last day of the week (Sunday) after or on monthEnd
  const endDayOfWeek = getDay(monthEnd);
  const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  const calendarEnd = new Date(monthEnd);
  calendarEnd.setDate(calendarEnd.getDate() + daysToAdd);

  return useQuery({
    queryKey: ["calendar-data", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return { days: [], monthTotal: 0 };

      // Fetch active bills
      const { data: bills, error: billsError } = await supabase
        .from("bills")
        .select(`
          *,
          category:categories(id, name, color, icon)
        `)
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (billsError) throw billsError;

      // Fetch stored occurrence statuses (paid/skipped)
      const { data: storedOccurrences } = await supabase
        .from("bill_occurrences")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", format(monthStart, "yyyy-MM-dd"))
        .lte("due_date", format(monthEnd, "yyyy-MM-dd"));

      // Create a map for quick lookup: "billId-dueDate" -> occurrence
      const occurrenceMap = new Map<string, typeof storedOccurrences[0]>();
      (storedOccurrences || []).forEach(occ => {
        occurrenceMap.set(`${occ.bill_id}-${occ.due_date}`, occ);
      });

      // Generate calendar days
      const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
      const today = new Date();
      
      let monthTotal = 0;
      
      const days: CalendarDay[] = allDays.map(date => {
        const isCurrentMonth = isSameMonth(date, currentDate);
        const dayBills: CalendarBill[] = [];

        // Check each bill for occurrences on this day
        (bills || []).forEach(bill => {
          const occurrences = getBillOccurrencesForMonth(bill, monthStart, monthEnd);
          occurrences.forEach(occurrence => {
            if (format(occurrence, "yyyy-MM-dd") === format(date, "yyyy-MM-dd")) {
              const occKey = `${bill.id}-${format(occurrence, "yyyy-MM-dd")}`;
              const storedOcc = occurrenceMap.get(occKey);
              
              // Determine status
              let status: CalendarBill["status"] = "due";
              let isPaid = false;
              let matchConfidence: string | undefined;
              
              if (storedOcc) {
                const storedStatus = storedOcc.status;
                if (storedStatus === "paid" || storedStatus === "skipped" || storedStatus === "overdue" || storedStatus === "due") {
                  status = storedStatus;
                }
                isPaid = storedStatus === "paid";
                matchConfidence = storedOcc.match_confidence || undefined;
              } else if (isBefore(date, today) && !isSameDay(date, today)) {
                // If due date is in the past and no stored status, mark as overdue
                status = "overdue";
              }
              
              const calendarBill: CalendarBill = {
                id: bill.id,
                name: bill.name,
                amount: Number(bill.amount),
                dueDate: occurrence,
                frequency: bill.frequency,
                categoryName: bill.category?.name,
                categoryColor: bill.category?.color,
                isPaid,
                status,
                matchConfidence,
              };
              dayBills.push(calendarBill);
              if (isCurrentMonth && status !== "skipped" && status !== "paid") {
                monthTotal += calendarBill.amount;
              }
            }
          });
        });

        return {
          date,
          isCurrentMonth,
          bills: dayBills,
          totalAmount: dayBills.reduce((sum, b) => sum + b.amount, 0),
        };
      });

      return { days, monthTotal };
    },
    enabled: !!user,
  });
}
