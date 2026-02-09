import { useState } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Transaction, useTransactions } from "@/hooks/useTransactions";
import { useBills } from "@/hooks/useBills";
import { useInvestments } from "@/hooks/useInvestments";
import { useTrackedServices } from "@/hooks/useTrackedServices";
import { useServicePayments } from "@/hooks/useServicePayments";
import { useAccounts } from "@/hooks/useAccounts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt, TrendingUp, Zap, Loader2, PiggyBank, Repeat } from "lucide-react";

interface LinkTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
}

export function LinkTransactionDialog({
  open,
  onOpenChange,
  transaction,
}: LinkTransactionDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { updateTransaction } = useTransactions();
  const { bills } = useBills();
  const { investments } = useInvestments();
  const { services } = useTrackedServices();
  const { createPayment } = useServicePayments();
  const { allAccounts } = useAccounts();

  const [selectedBillId, setSelectedBillId] = useState<string>(transaction.bill_id || "");
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<string>(
    // Pre-select if already linked to a subscription
    transaction.bill_id && bills.find(b => b.id === transaction.bill_id && b.is_subscription) 
      ? transaction.bill_id 
      : ""
  );
  const [selectedInvestmentId, setSelectedInvestmentId] = useState<string>(
    transaction.investment_account_id || ""
  );
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedSavingsId, setSelectedSavingsId] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);

  // Split bills into regular bills and subscriptions
  const activeBills = bills.filter((b) => b.is_active !== false && !b.is_subscription);
  const activeSubscriptions = bills.filter((b) => b.is_active !== false && b.is_subscription);
  const activeInvestments = investments.filter((i) => i.status === "active");
  const activeServices = services.filter((s) => s.status === "active");
  const savingsAccounts = allAccounts.filter(
    (a) => a.account_type === "savings" && a.id !== transaction.account_id
  );

  const handleLinkBill = async () => {
    if (!selectedBillId) return;
    setIsLinking(true);
    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        bill_id: selectedBillId === "none" ? null : selectedBillId,
      });
      onOpenChange(false);
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkSubscription = async () => {
    if (!selectedSubscriptionId) return;
    setIsLinking(true);
    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        bill_id: selectedSubscriptionId === "none" ? null : selectedSubscriptionId,
      });
      onOpenChange(false);
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkInvestment = async () => {
    if (!selectedInvestmentId || !user) return;
    setIsLinking(true);
    try {
      await updateTransaction.mutateAsync({
        id: transaction.id,
        investment_account_id: selectedInvestmentId === "none" ? null : selectedInvestmentId,
      });

      if (selectedInvestmentId !== "none") {
        const { error } = await supabase
          .from("investment_transactions")
          .upsert(
            {
              user_id: user.id,
              investment_account_id: selectedInvestmentId,
              transaction_date: transaction.transaction_date,
              type: transaction.type === "income" ? "withdrawal" : "deposit",
              amount: Math.abs(Number(transaction.amount)),
              notes: `Linked from: ${transaction.description}`,
              source_transaction_id: transaction.id,
            },
            { onConflict: "source_transaction_id" }
          );
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      } else {
        await supabase
          .from("investment_transactions")
          .delete()
          .eq("source_transaction_id", transaction.id);
        queryClient.invalidateQueries({ queryKey: ["investment-transactions"] });
      }

      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to link investment: ${error.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkService = async () => {
    if (!selectedServiceId || selectedServiceId === "none") return;
    setIsLinking(true);
    try {
      await createPayment({
        tracked_service_id: selectedServiceId,
        transaction_id: transaction.id,
        payment_date: transaction.transaction_date,
        amount: Math.abs(Number(transaction.amount)),
      });
      onOpenChange(false);
    } catch {
      // Error already shown by hook
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkSavings = async () => {
    if (!selectedSavingsId || selectedSavingsId === "none" || !user) return;
    setIsLinking(true);
    try {
      // Create a corresponding transaction in the savings account
      const amount = Math.abs(Number(transaction.amount));
      const { error } = await supabase.from("transactions").insert({
        account_id: selectedSavingsId,
        amount,
        type: "income" as const,
        description: `Transfer from ${transaction.account?.name || "account"}: ${transaction.description}`,
        transaction_date: transaction.transaction_date,
        category_id: transaction.category_id,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Linked to savings account");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to link savings: ${error.message}`);
    } finally {
      setIsLinking(false);
    }
  };

  // Determine default tab
  const defaultTab = transaction.bill_id && bills.find(b => b.id === transaction.bill_id && b.is_subscription)
    ? "subscription"
    : transaction.bill_id
    ? "bill"
    : transaction.investment_account_id
    ? "investment"
    : "bill";

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Link Transaction</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Link "{transaction.description}" to a bill, subscription, savings, investment, or service
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="bill" className="flex items-center gap-1 text-xs px-1">
                <Receipt className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Bill</span>
              </TabsTrigger>
              <TabsTrigger value="subscription" className="flex items-center gap-1 text-xs px-1">
                <Repeat className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Sub</span>
              </TabsTrigger>
              <TabsTrigger value="savings" className="flex items-center gap-1 text-xs px-1">
                <PiggyBank className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Savings</span>
              </TabsTrigger>
              <TabsTrigger value="investment" className="flex items-center gap-1 text-xs px-1">
                <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Invest</span>
              </TabsTrigger>
              <TabsTrigger value="service" className="flex items-center gap-1 text-xs px-1">
                <Zap className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">Service</span>
              </TabsTrigger>
            </TabsList>

            {/* Bill Tab */}
            <TabsContent value="bill" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Bill</Label>
                <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a bill..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No bill (unlink)</SelectItem>
                    {activeBills.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.name} - £{Number(bill.amount).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeBills.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active bills found</p>
                )}
              </div>
              <Button onClick={handleLinkBill} disabled={!selectedBillId || isLinking} className="w-full">
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedBillId === "none" ? "Unlink Bill" : "Link to Bill"}
              </Button>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Subscription</Label>
                <Select value={selectedSubscriptionId} onValueChange={setSelectedSubscriptionId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a subscription..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No subscription (unlink)</SelectItem>
                    {activeSubscriptions.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name} - £{Number(sub.amount).toFixed(2)}/{sub.frequency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeSubscriptions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active subscriptions found. Mark a bill as a subscription in the Bills page.</p>
                )}
              </div>
              <Button onClick={handleLinkSubscription} disabled={!selectedSubscriptionId || isLinking} className="w-full">
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedSubscriptionId === "none" ? "Unlink Subscription" : "Link to Subscription"}
              </Button>
            </TabsContent>

            {/* Savings Tab */}
            <TabsContent value="savings" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Savings Account</Label>
                <Select value={selectedSavingsId} onValueChange={setSelectedSavingsId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a savings account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {savingsAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.display_name || acc.name} - £{Number(acc.balance).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {savingsAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No savings accounts found. Add a savings account in Accounts.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This will create a matching deposit of £{Math.abs(Number(transaction.amount)).toFixed(2)} in the savings account.
              </p>
              <Button onClick={handleLinkSavings} disabled={!selectedSavingsId || selectedSavingsId === "none" || isLinking} className="w-full">
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Link to Savings
              </Button>
            </TabsContent>

            {/* Investment Tab */}
            <TabsContent value="investment" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Investment</Label>
                <Select value={selectedInvestmentId} onValueChange={setSelectedInvestmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an investment..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No investment (unlink)</SelectItem>
                    {activeInvestments.map((inv) => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.name} {inv.provider && `(${inv.provider})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeInvestments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No active investments found</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Linking will create a {transaction.type === "income" ? "withdrawal" : "deposit"} of £
                {Math.abs(Number(transaction.amount)).toFixed(2)} in the investment account.
              </p>
              <Button onClick={handleLinkInvestment} disabled={!selectedInvestmentId || isLinking} className="w-full">
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {selectedInvestmentId === "none" ? "Unlink Investment" : "Link to Investment"}
              </Button>
            </TabsContent>

            {/* Service Tab */}
            <TabsContent value="service" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Select Service (Cheaper Bills)</Label>
                <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeServices.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.provider} ({service.service_type}) - £{service.monthly_cost.toFixed(2)}/mo
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeServices.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tracked services found. Add services in Cheaper Bills.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                This will record a payment of £{Math.abs(Number(transaction.amount)).toFixed(2)} for
                the selected service.
              </p>
              <Button
                onClick={handleLinkService}
                disabled={!selectedServiceId || selectedServiceId === "none" || isLinking}
                className="w-full"
              >
                {isLinking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Link to Service
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
