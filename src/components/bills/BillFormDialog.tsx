import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bill, BillInsert, useBills } from "@/hooks/useBills";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { Constants } from "@/integrations/supabase/types";

const billFrequencies = Constants.public.Enums.bill_frequency;

const billSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  amount: z.coerce.number().positive("Amount must be positive"),
  due_day: z.coerce.number().int().min(1, "Day must be 1-31").max(31, "Day must be 1-31"),
  frequency: z.enum(billFrequencies as unknown as [string, ...string[]]),
  provider: z.string().trim().max(100, "Provider must be less than 100 characters").optional(),
  category_id: z.string().optional(),
  account_id: z.string().optional(),
  notes: z.string().trim().max(500, "Notes must be less than 500 characters").optional(),
  is_active: z.boolean(),
  start_date: z.date().optional().nullable(),
  end_date: z.date().optional().nullable(),
});

type BillFormData = z.infer<typeof billSchema>;

interface BillFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill?: Bill | null;
}

export function BillFormDialog({ open, onOpenChange, bill }: BillFormDialogProps) {
  const { createBill, updateBill } = useBills();
  const { data: categories = [] } = useCategories();
  const { accounts } = useAccounts();
  const isEditing = !!bill;

  const form = useForm<BillFormData>({
    resolver: zodResolver(billSchema),
    defaultValues: {
      name: "",
      amount: 0,
      due_day: 1,
      frequency: "monthly",
      provider: "",
      category_id: "",
      account_id: "",
      notes: "",
      is_active: true,
      start_date: null,
      end_date: null,
    },
  });

  useEffect(() => {
    if (bill) {
      form.reset({
        name: bill.name,
        amount: Number(bill.amount),
        due_day: bill.due_day,
        frequency: bill.frequency,
        provider: bill.provider || "",
        category_id: bill.category_id || "",
        account_id: bill.account_id || "",
        notes: bill.notes || "",
        is_active: bill.is_active ?? true,
        start_date: bill.start_date ? new Date(bill.start_date) : null,
        end_date: bill.end_date ? new Date(bill.end_date) : null,
      });
    } else {
      form.reset({
        name: "",
        amount: 0,
        due_day: 1,
        frequency: "monthly",
        provider: "",
        category_id: "",
        account_id: "",
        notes: "",
        is_active: true,
        start_date: null,
        end_date: null,
      });
    }
  }, [bill, form, open]);

  const onSubmit = async (data: BillFormData) => {
    const billData: BillInsert = {
      name: data.name,
      amount: data.amount,
      due_day: data.due_day,
      frequency: data.frequency as typeof billFrequencies[number],
      provider: data.provider || null,
      category_id: data.category_id || null,
      account_id: data.account_id || null,
      notes: data.notes || null,
      is_active: data.is_active,
      start_date: data.start_date ? format(data.start_date, "yyyy-MM-dd") : null,
      end_date: data.end_date ? format(data.end_date, "yyyy-MM-dd") : null,
    };

    if (isEditing && bill) {
      await updateBill.mutateAsync({ id: bill.id, ...billData });
    } else {
      await createBill.mutateAsync(billData);
    }

    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEditing ? "Edit Bill" : "Add Bill"}</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {isEditing
              ? "Update the details of your recurring bill."
              : "Add a new recurring bill or subscription."}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Bill Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Netflix, Rent, Phone Bill"
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Label htmlFor="due_day">Due Day (1-31) *</Label>
              <Input
                id="due_day"
                type="number"
                min="1"
                max="31"
                placeholder="1"
                {...form.register("due_day")}
              />
              {form.formState.errors.due_day && (
                <p className="text-sm text-destructive">{form.formState.errors.due_day.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select
                value={form.watch("frequency")}
                onValueChange={(value) => form.setValue("frequency", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="fortnightly">Fortnightly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.watch("category_id") || "none"}
                onValueChange={(value) => form.setValue("category_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                placeholder="e.g., Virgin Media, EE"
                {...form.register("provider")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="account">Payment Account</Label>
              <Select
                value={form.watch("account_id") || "none"}
                onValueChange={(value) => form.setValue("account_id", value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  <SelectItem value="none">Any account</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={form.watch("start_date") ? format(form.watch("start_date")!, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  form.setValue("start_date", value ? new Date(value + "T00:00:00") : null);
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={form.watch("end_date") ? format(form.watch("end_date")!, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const value = e.target.value;
                  form.setValue("end_date", value ? new Date(value + "T00:00:00") : null);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional notes..."
              {...form.register("notes")}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is_active">Active</Label>
            <Switch
              id="is_active"
              checked={form.watch("is_active")}
              onCheckedChange={(checked) => form.setValue("is_active", checked)}
            />
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createBill.isPending || updateBill.isPending}
            >
              {isEditing ? "Save Changes" : "Add Bill"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
