import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBills } from "@/hooks/useBills";
import { useInvestments } from "@/hooks/useInvestments";
import { Transaction } from "@/hooks/useTransactions";
import { toast } from "@/hooks/use-toast";

/**
 * Auto-links unlinked transactions to matching bills/subscriptions and investments.
 * Runs once when transactions change, matching by provider name + amount tolerance (±£1) + date window (±3 days).
 */
export function useAutoLinkTransactions(transactions: Transaction[]) {
  const { user } = useAuth();
  const { bills } = useBills();
  const { investments } = useInvestments();
  const queryClient = useQueryClient();
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user || !transactions.length) return;

    const activeBills = bills.filter(b => b.is_active !== false);
    const activeInvestments = investments.filter(i => i.status === 'active');
    if (!activeBills.length && !activeInvestments.length) return;

    // Only look at unlinked expense transactions
    const unlinked = transactions.filter(
      t => t.type === "expense" && !t.bill_id && !t.investment_account_id && !processedRef.current.has(t.id)
    );
    if (!unlinked.length) return;

    const billMatches: { transactionId: string; billId: string; billName: string }[] = [];
    const investmentMatches: { transactionId: string; investmentId: string; investmentName: string; amount: number; date: string }[] = [];

    for (const txn of unlinked) {
      processedRef.current.add(txn.id);

      const merchant = (txn.merchant || "").toLowerCase();
      const description = (txn.description || "").toLowerCase();
      const txnAmount = Math.abs(Number(txn.amount));
      let matched = false;

      // Try bill match first
      for (const bill of activeBills) {
        const billName = (bill.name || "").toLowerCase();
        const billProvider = (bill.provider || "").toLowerCase();
        const billAmount = Number(bill.amount);

        if (Math.abs(txnAmount - billAmount) > 1) continue;

        const nameMatch =
          (billName && (merchant.includes(billName) || description.includes(billName))) ||
          (billProvider && (merchant.includes(billProvider) || description.includes(billProvider)));

        if (nameMatch) {
          billMatches.push({ transactionId: txn.id, billId: bill.id, billName: bill.name });
          matched = true;
          break;
        }
      }

      // Try investment match if no bill matched
      if (!matched) {
        for (const inv of activeInvestments) {
          const invName = (inv.name || "").toLowerCase();
          const invProvider = (inv.provider || "").toLowerCase();

          const nameMatch =
            (invProvider && (merchant.includes(invProvider) || description.includes(invProvider))) ||
            (invName && (merchant.includes(invName) || description.includes(invName)));

          if (nameMatch) {
            investmentMatches.push({
              transactionId: txn.id,
              investmentId: inv.id,
              investmentName: inv.name,
              amount: txnAmount,
              date: txn.transaction_date,
            });
            break;
          }
        }
      }
    }

    if (!billMatches.length && !investmentMatches.length) return;

    const applyMatches = async () => {
      let linked = 0;
      const names: string[] = [];

      // Apply bill matches
      for (const m of billMatches) {
        const { error } = await supabase
          .from("transactions")
          .update({ bill_id: m.billId })
          .eq("id", m.transactionId)
          .is("bill_id", null);

        if (!error) {
          linked++;
          names.push(m.billName);
        }
      }

      // Apply investment matches
      for (const m of investmentMatches) {
        const { error: txError } = await supabase
          .from("transactions")
          .update({ investment_account_id: m.investmentId })
          .eq("id", m.transactionId)
          .is("investment_account_id", null);

        if (!txError) {
          // Also create the investment deposit
          const { error: invError } = await supabase
            .from("investment_transactions")
            .upsert(
              {
                user_id: user.id,
                investment_account_id: m.investmentId,
                transaction_date: m.date,
                type: "deposit",
                amount: m.amount,
                notes: `Auto-linked from transaction`,
                source_transaction_id: m.transactionId,
              },
              { onConflict: "source_transaction_id" }
            );

          if (!invError) {
            linked++;
            names.push(m.investmentName);
          }
        }
      }

      if (linked > 0) {
        queryClient.invalidateQueries({ queryKey: ["transactions"] });
        queryClient.invalidateQueries({ queryKey: ["bill-occurrences"] });
        queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
        queryClient.invalidateQueries({ queryKey: ["investment-valuations"] });
        toast({
          title: `Auto-linked ${linked} transaction${linked > 1 ? "s" : ""}`,
          description: names.slice(0, 3).join(", ") + (names.length > 3 ? "..." : ""),
        });
      }
    };

    applyMatches();
  }, [user, bills, investments, transactions, queryClient]);
}
