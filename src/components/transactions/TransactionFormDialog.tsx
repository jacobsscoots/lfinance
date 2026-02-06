import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Transaction, TransactionInsert, useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";

const transactionSchema = z.object({
  description: z.string().trim().min(1, "Description is required").max(200, "Description must be less than 200 characters"),
  amount: z.coerce.number().positive("Amount must be positive"),
  type: z.enum(["income", "expense"]),
  transaction_date: z.date(),
  account_id: z.string().min(1, "Account is required"),
  category_id: z.string().optional(),
  merchant: z.string().trim().max(100, "Merchant must be less than 100 characters").optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
}

export function TransactionFormDialog({ open, onOpenChange, transaction }: TransactionFormDialogProps) {
  const { createTransaction, updateTransaction } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { accounts } = useAccounts();
  const isEditing = !!transaction;
  const [date, setDate] = useState<Date>(new Date());

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: "",
      amount: 0,
      type: "expense",
      transaction_date: new Date(),
      account_id: "",
      category_id: "",
      merchant: "",
    },
  });

  useEffect(() => {
    if (transaction) {
      const txDate = new Date(transaction.transaction_date);
      setDate(txDate);
      form.reset({
        description: transaction.description,
        amount: Number(transaction.amount),
        type: transaction.type,
        transaction_date: txDate,
        account_id: transaction.account_id,
        category_id: transaction.category_id || "",
        merchant: transaction.merchant || "",
      });
    } else {
      const today = new Date();
      setDate(today);
      form.reset({
        description: "",
        amount: 0,
        type: "expense",
        transaction_date: today,
        account_id: accounts[0]?.id || "",
        category_id: "",
        merchant: "",
      });
    }
  }, [transaction, form, open, accounts]);

  const onSubmit = async (data: TransactionFormData) => {
    const txData: TransactionInsert = {
      description: data.description,
      amount: data.amount,
      type: data.type,
      transaction_date: format(data.transaction_date, "yyyy-MM-dd"),
      account_id: data.account_id,
      category_id: data.category_id || null,
      merchant: data.merchant || null,
    };

    if (isEditing && transaction) {
      await updateTransaction.mutateAsync({ id: transaction.id, ...txData });
    } else {
      await createTransaction.mutateAsync(txData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the transaction details." : "Record a new transaction."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="e.g., Grocery shopping, Salary"
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (£) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                {...form.register("amount")}
              />
              {form.formState.errors.amount && (
                <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={form.watch("type")}
                onValueChange={(value: "income" | "expense") => form.setValue("type", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "d MMM yyyy") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => {
                      if (newDate) {
                        setDate(newDate);
                        form.setValue("transaction_date", newDate);
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Account *</Label>
              <Select
                value={form.watch("account_id")}
                onValueChange={(value) => form.setValue("account_id", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.account_id && (
                <p className="text-sm text-destructive">{form.formState.errors.account_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.watch("category_id") || "none"}
                onValueChange={(value) => form.setValue("category_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                placeholder="e.g., Tesco, Amazon"
                {...form.register("merchant")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createTransaction.isPending || updateTransaction.isPending}
            >
              {isEditing ? "Save Changes" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
