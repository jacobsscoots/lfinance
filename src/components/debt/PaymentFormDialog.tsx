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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDebtPayments, PaymentCategory } from "@/hooks/useDebtPayments";
import { useDebts, Debt } from "@/hooks/useDebts";
import { format } from "date-fns";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

const paymentFormSchema = z.object({
  debt_id: z.string().min(1, "Please select a debt"),
  payment_date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().min(0.01, "Amount must be positive"),
  category: z.enum(['normal', 'extra', 'fee', 'refund', 'adjustment']),
  principal_amount: z.coerce.number().min(0).optional().nullable(),
  interest_amount: z.coerce.number().min(0).optional().nullable(),
  fee_amount: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

interface PaymentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debts: Debt[];
  preselectedDebtId?: string;
}

export function PaymentFormDialog({ 
  open, 
  onOpenChange, 
  debts,
  preselectedDebtId 
}: PaymentFormDialogProps) {
  const { createPayment } = useDebtPayments();
  const { updateDebtBalance, debts: allDebts } = useDebts();
  const [showSplit, setShowSplit] = useState(false);

  const form = useForm<PaymentFormValues>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: {
      debt_id: "",
      payment_date: format(new Date(), 'yyyy-MM-dd'),
      amount: 0,
      category: "normal",
      principal_amount: null,
      interest_amount: null,
      fee_amount: null,
      notes: null,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        debt_id: preselectedDebtId || "",
        payment_date: format(new Date(), 'yyyy-MM-dd'),
        amount: 0,
        category: "normal",
        principal_amount: null,
        interest_amount: null,
        fee_amount: null,
        notes: null,
      });
      setShowSplit(false);
    }
  }, [open, preselectedDebtId, form]);

  const onSubmit = async (values: PaymentFormValues) => {
    try {
      // Create the payment
      await createPayment.mutateAsync({
        debt_id: values.debt_id,
        payment_date: values.payment_date,
        amount: values.amount,
        category: values.category,
        principal_amount: values.principal_amount,
        interest_amount: values.interest_amount,
        fee_amount: values.fee_amount,
        notes: values.notes,
      });

      // Update debt balance based on category
      const debt = allDebts.find(d => d.id === values.debt_id);
      if (debt) {
        let newBalance = Number(debt.current_balance);
        
        switch (values.category) {
          case 'normal':
          case 'extra':
            newBalance -= values.amount;
            break;
          case 'fee':
          case 'adjustment':
            // Fees/adjustments add to balance by default
            newBalance += values.amount;
            break;
          case 'refund':
            // Refunds add back to balance
            newBalance += values.amount;
            break;
        }
        
        await updateDebtBalance.mutateAsync({
          id: debt.id,
          newBalance: Math.max(0, newBalance),
        });
      }

      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const openDebts = debts.filter(d => d.status === 'open');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Log Payment</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="debt_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Debt *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select debt" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {openDebts.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.creditor_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (£) *</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="normal">Normal Payment</SelectItem>
                      <SelectItem value="extra">Extra Payment</SelectItem>
                      <SelectItem value="fee">Fee (adds to balance)</SelectItem>
                      <SelectItem value="refund">Refund (adds to balance)</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Collapsible open={showSplit} onOpenChange={setShowSplit}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full justify-between">
                  Split breakdown (optional)
                  <ChevronDown className={`h-4 w-4 transition-transform ${showSplit ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="principal_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Principal</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="£"
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="interest_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Interest</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="£"
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="fee_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Fees</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="£"
                            {...field} 
                            value={field.value ?? ''} 
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes..."
                      rows={2}
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
              <Button type="submit" disabled={createPayment.isPending}>
                Log Payment
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
