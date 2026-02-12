import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  eachDayOfInterval, 
  isSameDay,
  format,
  getDay,
  isBefore,
  startOfDay,
} from "date-fns";
import { generateBillOccurrences } from "@/lib/billOccurrences";
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
  isInPayCycle: boolean;
  bills: CalendarBill[];
  totalAmount: number;
}

export function useCalendarData(cycleStart: Date, cycleEnd: Date) {
  const { user } = useAuth();

  // Build the visual grid: expand to full weeks (Mon-Sun)
  const startDayOfWeek = getDay(cycleStart);
  const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  const calendarGridStart = new Date(cycleStart);
  calendarGridStart.setDate(calendarGridStart.getDate() - daysToSubtract);

  const endDayOfWeek = getDay(cycleEnd);
  const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  const calendarGridEnd = new Date(cycleEnd);
  calendarGridEnd.setDate(calendarGridEnd.getDate() + daysToAdd);

  return useQuery({
    queryKey: ["calendar-data", user?.id, format(cycleStart, "yyyy-MM-dd"), format(cycleEnd, "yyyy-MM-dd")],
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

      // Fetch stored occurrence statuses for the full grid range
      const { data: storedOccurrences } = await supabase
        .from("bill_occurrences")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", format(calendarGridStart, "yyyy-MM-dd"))
        .lte("due_date", format(calendarGridEnd, "yyyy-MM-dd"));

      // Fetch transactions that are already linked to bills (via auto-link or manual link)
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);

      let linkedTransactions: { bill_id: string; transaction_date: string; id: string }[] = [];
      if (accounts?.length) {
        const accountIds = accounts.map(a => a.id);
        const { data: txns } = await supabase
          .from("transactions")
          .select("id, bill_id, transaction_date")
          .in("account_id", accountIds)
          .not("bill_id", "is", null)
          .gte("transaction_date", format(calendarGridStart, "yyyy-MM-dd"))
          .lte("transaction_date", format(calendarGridEnd, "yyyy-MM-dd"));
        linkedTransactions = (txns || []) as typeof linkedTransactions;
      }

      // Build a set of "billId-date" from linked transactions for quick lookup
      const linkedTxnMap = new Map<string, string>();
      linkedTransactions.forEach(txn => {
        // A linked transaction marks the bill as paid around that date
        linkedTxnMap.set(`${txn.bill_id}-${txn.transaction_date}`, txn.id);
      });

      // Create a map for quick lookup: "billId-dueDate" -> occurrence
      const occurrenceMap = new Map<string, (typeof storedOccurrences)[0]>();
      (storedOccurrences || []).forEach(occ => {
        occurrenceMap.set(`${occ.bill_id}-${occ.due_date}`, occ);
      });

      // Generate all bill occurrences for the grid range using the SHARED engine
      const allOccurrences = (bills || []).flatMap(bill =>
        generateBillOccurrences(bill as any, calendarGridStart, calendarGridEnd).map(occ => ({
          ...occ,
          bill: bill as Bill,
        }))
      );

      // Build a map of date -> occurrences
      const occByDate = new Map<string, typeof allOccurrences>();
      allOccurrences.forEach(occ => {
        const dateKey = format(occ.dueDate, "yyyy-MM-dd");
        if (!occByDate.has(dateKey)) occByDate.set(dateKey, []);
        occByDate.get(dateKey)!.push(occ);
      });

      // Generate calendar days
      const allDays = eachDayOfInterval({ start: calendarGridStart, end: calendarGridEnd });
      const today = startOfDay(new Date());

      let monthTotal = 0;

      const days: CalendarDay[] = allDays.map(date => {
        const dateKey = format(date, "yyyy-MM-dd");
        const isInPayCycle = date >= cycleStart && date <= cycleEnd;
        const dayOccurrences = occByDate.get(dateKey) || [];

        const dayBills: CalendarBill[] = dayOccurrences.map(occ => {
          const occKey = `${occ.billId}-${dateKey}`;
          const storedOcc = occurrenceMap.get(occKey);

          let status: CalendarBill["status"] = "due";
          let isPaid = false;
          let matchConfidence: string | undefined;

          // FIRST: check if a linked transaction exists for this bill within ±3 days
          const dueDateMs = date.getTime();
          const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
          const foundLinked = linkedTransactions.find(txn => {
            if (txn.bill_id !== occ.billId) return false;
            const txnDate = new Date(txn.transaction_date + "T12:00:00").getTime();
            return Math.abs(txnDate - dueDateMs) <= threeDaysMs;
          });

          if (foundLinked) {
            // Transaction linked from Transactions page — auto-paid
            status = "paid";
            isPaid = true;
            matchConfidence = "auto";
          } else if (storedOcc) {
            // Fall back to stored occurrence record
            const storedStatus = storedOcc.status;
            if (storedStatus === "paid" || storedStatus === "skipped" || storedStatus === "overdue" || storedStatus === "due") {
              status = storedStatus;
            }
            isPaid = storedStatus === "paid";
            matchConfidence = storedOcc.match_confidence || undefined;
          } else if (isBefore(date, today) && !isSameDay(date, today)) {
            status = "overdue";
          }

          return {
            id: occ.billId,
            name: occ.billName,
            amount: occ.expectedAmount,
            dueDate: occ.dueDate,
            frequency: occ.bill.frequency,
            categoryName: occ.bill.category?.name,
            categoryColor: occ.bill.category?.color,
            isPaid,
            status,
            matchConfidence,
          };
        });

        // Only count bills in the pay cycle for the total
        if (isInPayCycle) {
          dayBills.forEach(b => {
            if (b.status !== "skipped" && b.status !== "paid") {
              monthTotal += b.amount;
            }
          });
        }

        return {
          date,
          isCurrentMonth: isInPayCycle,
          isInPayCycle,
          bills: dayBills,
          totalAmount: dayBills.reduce((sum, b) => sum + b.amount, 0),
        };
      });

      return { days, monthTotal };
    },
    enabled: !!user,
  });
}
