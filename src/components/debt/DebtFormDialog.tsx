import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebts, Debt, DebtType, InterestType } from "@/hooks/useDebts";
import { useAccounts } from "@/hooks/useAccounts";
import { format } from "date-fns";
import { Link } from "lucide-react";

const debtFormSchema = z.object({
  creditor_name: z.string().min(1, "Creditor name is required"),
  debt_type: z.enum(['credit_card', 'loan', 'overdraft', 'bnpl', 'other']),
  starting_balance: z.coerce.number().min(0.01, "Starting balance must be positive"),
  current_balance: z.coerce.number().min(0, "Current balance cannot be negative"),
  apr: z.coerce.number().min(0).max(100).optional().nullable(),
  interest_type: z.enum(['apr', 'fixed', 'none']),
  promo_end_date: z.string().optional().nullable(),
  min_payment: z.coerce.number().min(0).optional().nullable(),
  due_day: z.coerce.number().min(1).max(31).optional().nullable(),
  status: z.enum(['open', 'closed']),
  opened_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  linked_account_id: z.string().optional().nullable(),
});

type DebtFormValues = z.infer<typeof debtFormSchema>;

interface DebtFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debt?: Debt;
}

export function DebtFormDialog({ open, onOpenChange, debt }: DebtFormDialogProps) {
  const { createDebt, updateDebt } = useDebts();
  const { allAccounts } = useAccounts();
  const isEditing = !!debt;

  // Filter to credit-type accounts for linking
  const creditAccounts = allAccounts.filter(a => 
    a.account_type === 'credit' || a.account_type === 'loan'
  );

  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      creditor_name: "",
      debt_type: "credit_card",
      starting_balance: 0,
      current_balance: 0,
      apr: null,
      interest_type: "apr",
      promo_end_date: null,
      min_payment: null,
      due_day: null,
      status: "open",
      opened_date: format(new Date(), 'yyyy-MM-dd'),
      notes: null,
      linked_account_id: null,
    },
  });

  useEffect(() => {
    if (open && debt) {
      form.reset({
        creditor_name: debt.creditor_name,
        debt_type: debt.debt_type,
        starting_balance: Number(debt.starting_balance),
        current_balance: Number(debt.current_balance),
        apr: debt.apr ? Number(debt.apr) : null,
        interest_type: debt.interest_type,
        promo_end_date: debt.promo_end_date,
        min_payment: debt.min_payment ? Number(debt.min_payment) : null,
        due_day: debt.due_day,
        status: debt.status,
        opened_date: debt.opened_date,
        notes: debt.notes,
        linked_account_id: debt.linked_account_id || null,
      });
    } else if (open) {
      form.reset({
        creditor_name: "",
        debt_type: "credit_card",
        starting_balance: 0,
        current_balance: 0,
        apr: null,
        interest_type: "apr",
        promo_end_date: null,
        min_payment: null,
        due_day: null,
        status: "open",
        opened_date: format(new Date(), 'yyyy-MM-dd'),
        notes: null,
        linked_account_id: null,
      });
    }
  }, [open, debt, form]);

  const onSubmit = async (values: DebtFormValues) => {
    try {
      if (isEditing && debt) {
        await updateDebt.mutateAsync({
          id: debt.id,
          ...values,
        });
      } else {
        await createDebt.mutateAsync({
          creditor_name: values.creditor_name,
          debt_type: values.debt_type,
          starting_balance: values.starting_balance,
          current_balance: values.current_balance,
          apr: values.apr,
          interest_type: values.interest_type,
          promo_end_date: values.promo_end_date,
          min_payment: values.min_payment,
          due_day: values.due_day,
          status: values.status,
          opened_date: values.opened_date,
          notes: values.notes,
          linked_account_id: values.linked_account_id || null,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Debt" : "Add Debt"}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="creditor_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Creditor Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Barclaycard" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="debt_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="credit_card">Credit Card</SelectItem>
                        <SelectItem value="loan">Loan</SelectItem>
                        <SelectItem value="overdraft">Overdraft</SelectItem>
                        <SelectItem value="bnpl">Buy Now Pay Later</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="starting_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Starting Balance (£) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="current_balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Current Balance (£) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="apr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>APR (%)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.1" 
                        placeholder="e.g., 24.9"
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="interest_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apr">APR</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                        <SelectItem value="none">None (0%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="min_payment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Min Payment (£)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="e.g., 25"
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_day"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Day (1-31)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1}
                        max={31}
                        placeholder="e.g., 15"
                        {...field} 
                        value={field.value ?? ''} 
                        onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="opened_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opened Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value ?? ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="promo_end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>0% Promo Ends</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field} 
                        value={field.value ?? ''} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Link to Bank Account */}
            <FormField
              control={form.control}
              name="linked_account_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1.5">
                    <Link className="h-3.5 w-3.5" />
                    Link to Bank Account
                  </FormLabel>
                  <Select 
                    onValueChange={(v) => field.onChange(v === "none" ? null : v)} 
                    value={field.value || "none"}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="No account linked" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No account linked</SelectItem>
                      {allAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.display_name || acc.name} (£{Math.abs(acc.balance).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Balance will auto-update when this account syncs
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes..."
                      {...field} 
                      value={field.value ?? ''} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDebt.isPending || updateDebt.isPending}>
                {isEditing ? "Save Changes" : "Add Debt"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
