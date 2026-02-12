import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { getBillOccurrencesForMonth, getBillOccurrencesInRange, BillOccurrence } from "@/lib/billOccurrences";
import { autoMatchTransactions, Transaction } from "@/lib/transactionMatcher";
import { toast } from "@/hooks/use-toast";
import { format, isBefore, startOfDay, startOfMonth, endOfMonth } from "date-fns";

export function useBillOccurrences(year: number, month: number, rangeStart?: Date, rangeEnd?: Date) {
  const { user } = useAuth();
  const { bills } = useBills();
  const queryClient = useQueryClient();

  // Generate occurrences from bills — use range if provided, else single month
  const computedOccurrences = rangeStart && rangeEnd
    ? getBillOccurrencesInRange(bills, rangeStart, rangeEnd)
    : getBillOccurrencesForMonth(bills, year, month);

  // Date range for DB queries
  const queryStart = rangeStart ? format(rangeStart, "yyyy-MM-dd") : format(new Date(year, month, 1), "yyyy-MM-dd");
  const queryEnd = rangeEnd ? format(rangeEnd, "yyyy-MM-dd") : format(new Date(year, month + 1, 0), "yyyy-MM-dd");

  // Fetch stored occurrence statuses (paid/skipped)
  const storedOccurrencesQuery = useQuery({
    queryKey: ["bill-occurrences", user?.id, queryStart, queryEnd],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("bill_occurrences")
        .select("*")
        .eq("user_id", user.id)
        .gte("due_date", queryStart)
        .lte("due_date", queryEnd);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch transactions for auto-matching
  const transactionsQuery = useQuery({
    queryKey: ["transactions-for-matching", user?.id, queryStart, queryEnd],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: accounts } = await supabase
        .from("bank_accounts")
        .select("id")
        .eq("user_id", user.id);
      
      if (!accounts?.length) return [];
      
      const accountIds = accounts.map(a => a.id);
      
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, merchant, description, transaction_date, account_id, bill_id, is_pending")
        .in("account_id", accountIds)
        .gte("transaction_date", queryStart)
        .lte("transaction_date", queryEnd)
        .eq("type", "expense");
      
      if (error) throw error;
      return (data || []) as Transaction[];
    },
    enabled: !!user,
  });

  // Merge computed occurrences with stored statuses
  const mergedOccurrences = computedOccurrences.map(occ => {
    const stored = storedOccurrencesQuery.data?.find(
      s => s.bill_id === occ.billId && s.due_date === format(occ.dueDate, "yyyy-MM-dd")
    );
    
    if (stored) {
      return {
        ...occ,
        status: stored.status as BillOccurrence["status"],
        paidTransactionId: stored.paid_transaction_id || undefined,
        paidAt: stored.paid_at ? new Date(stored.paid_at) : undefined,
        matchConfidence: stored.match_confidence as BillOccurrence["matchConfidence"],
      };
    }
    
    const today = startOfDay(new Date());
    if (occ.status === "due" && isBefore(occ.dueDate, today)) {
      return { ...occ, status: "overdue" as const };
    }
    
    return occ;
  });

  // Get existing transaction links
  const existingLinks = new Map<string, string>();
  storedOccurrencesQuery.data?.forEach(stored => {
    if (stored.paid_transaction_id) {
      existingLinks.set(stored.paid_transaction_id, `${stored.bill_id}-${stored.due_date}`);
    }
  });

  // Auto-match results
  const matchResults = transactionsQuery.data 
    ? autoMatchTransactions(mergedOccurrences, transactionsQuery.data, existingLinks)
    : { autoApply: [], forReview: [] };

  /**
   * Parse an occurrence ID ("uuid-yyyy-MM-dd") back to billId + dueDate.
   * UUID is 36 chars, then a dash, then 10-char date.
   */
  const parseOccurrenceId = (occurrenceId: string): { billId: string; dueDate: string } | null => {
    // Occurrence IDs are formatted as `${billId}-${format(dueDate, "yyyy-MM-dd")}`
    // UUIDs are 36 chars (8-4-4-4-12), so the date starts at position 37
    const dateStr = occurrenceId.slice(-10); // last 10 chars = yyyy-MM-dd
    const billId = occurrenceId.slice(0, -11); // everything before the last dash + date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr) && billId.length === 36) {
      return { billId, dueDate: dateStr };
    }
    return null;
  };

  // Mark occurrence as paid
  const markPaid = useMutation({
    mutationFn: async ({ 
      occurrenceId, 
      transactionId, 
      confidence 
    }: { 
      occurrenceId: string; 
      transactionId?: string; 
      confidence?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Try finding in merged occurrences first
      let occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      
      // If not found, parse the ID directly (handles cross-month pay cycles)
      if (!occurrence) {
        const parsed = parseOccurrenceId(occurrenceId);
        if (!parsed) throw new Error("Invalid occurrence ID");
        
        const bill = bills.find(b => b.id === parsed.billId);
        if (!bill) throw new Error("Bill not found");
        
        occurrence = {
          id: occurrenceId,
          billId: parsed.billId,
          billName: bill.name,
          dueDate: new Date(parsed.dueDate + "T12:00:00"),
          expectedAmount: Number(bill.amount),
          status: "due" as const,
          bill: bill as any,
        };
      }
      
      const { error } = await supabase.from("bill_occurrences").upsert({
        user_id: user.id,
        bill_id: occurrence.billId,
        due_date: format(occurrence.dueDate, "yyyy-MM-dd"),
        expected_amount: occurrence.expectedAmount,
        status: "paid",
        paid_transaction_id: transactionId || null,
        paid_at: new Date().toISOString(),
        match_confidence: confidence || "manual",
      }, {
        onConflict: "bill_id,due_date",
      });
      
      if (error) throw error;

      if (transactionId) {
        await supabase
          .from("transactions")
          .update({ bill_id: occurrence.billId })
          .eq("id", transactionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      toast({ title: "Bill marked as paid" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Skip occurrence
  const skipOccurrence = useMutation({
    mutationFn: async (occurrenceId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      let occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      
      if (!occurrence) {
        const parsed = parseOccurrenceId(occurrenceId);
        if (!parsed) throw new Error("Invalid occurrence ID");
        const bill = bills.find(b => b.id === parsed.billId);
        if (!bill) throw new Error("Bill not found");
        occurrence = {
          id: occurrenceId, billId: parsed.billId, billName: bill.name,
          dueDate: new Date(parsed.dueDate + "T12:00:00"),
          expectedAmount: Number(bill.amount), status: "due" as const, bill: bill as any,
        };
      }
      
      const { error } = await supabase.from("bill_occurrences").upsert({
        user_id: user.id,
        bill_id: occurrence.billId,
        due_date: format(occurrence.dueDate, "yyyy-MM-dd"),
        expected_amount: occurrence.expectedAmount,
        status: "skipped",
      }, {
        onConflict: "bill_id,due_date",
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      toast({ title: "Bill skipped" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Reset occurrence
  const resetOccurrence = useMutation({
    mutationFn: async (occurrenceId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      let occurrence = mergedOccurrences.find(o => o.id === occurrenceId);
      
      if (!occurrence) {
        const parsed = parseOccurrenceId(occurrenceId);
        if (!parsed) throw new Error("Invalid occurrence ID");
        const bill = bills.find(b => b.id === parsed.billId);
        if (!bill) throw new Error("Bill not found");
        occurrence = {
          id: occurrenceId, billId: parsed.billId, billName: bill.name,
          dueDate: new Date(parsed.dueDate + "T12:00:00"),
          expectedAmount: Number(bill.amount), status: "due" as const, bill: bill as any,
        };
      }

      const stored = storedOccurrencesQuery.data?.find(
        s => s.bill_id === occurrence!.billId && s.due_date === format(occurrence!.dueDate, "yyyy-MM-dd")
      );
      
      if (stored?.paid_transaction_id) {
        await supabase
          .from("transactions")
          .update({ bill_id: null })
          .eq("id", stored.paid_transaction_id);
      }

      const { error } = await supabase
        .from("bill_occurrences")
        .delete()
        .eq("user_id", user.id)
        .eq("bill_id", occurrence.billId)
        .eq("due_date", format(occurrence.dueDate, "yyyy-MM-dd"));
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-data"] });
      toast({ title: "Bill reset to due" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Apply auto-match
  const applyAutoMatches = useMutation({
    mutationFn: async () => {
      for (const match of matchResults.autoApply) {
        await markPaid.mutateAsync({
          occurrenceId: match.occurrence.id,
          transactionId: match.transactionId,
          confidence: match.confidence,
        });
      }
    },
    onSuccess: () => {
      toast({ 
        title: "Auto-matched bills", 
        description: `${matchResults.autoApply.length} bill(s) marked as paid` 
      });
    },
  });

  return {
    occurrences: mergedOccurrences,
    isLoading: storedOccurrencesQuery.isLoading || transactionsQuery.isLoading,
    suggestedMatches: matchResults.forReview,
    autoMatchCount: matchResults.autoApply.length,
    markPaid,
    skipOccurrence,
    resetOccurrence,
    applyAutoMatches,
  };
}
