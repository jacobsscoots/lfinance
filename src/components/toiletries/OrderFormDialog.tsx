import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Package } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ToiletryOrder } from "@/hooks/useToiletryOrders";
import { format } from "date-fns";

const orderFormSchema = z.object({
  order_date: z.string().min(1, "Order date is required"),
  retailer: z.string().min(1, "Retailer is required").max(100),
  order_reference: z.string().max(100).optional(),
  subtotal: z.coerce.number().min(0, "Cannot be negative"),
  delivery_cost: z.coerce.number().min(0, "Cannot be negative"),
  dispatch_date: z.string().optional(),
  estimated_delivery: z.string().optional(),
  actual_delivery: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: Omit<ToiletryOrder, "id" | "user_id" | "created_at" | "updated_at">) => void;
  initialData?: ToiletryOrder | null;
  isLoading?: boolean;
}

export function OrderFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false,
}: OrderFormDialogProps) {
  const isEditing = !!initialData;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      order_date: format(new Date(), "yyyy-MM-dd"),
      retailer: "",
      order_reference: "",
      subtotal: 0,
      delivery_cost: 0,
      dispatch_date: "",
      estimated_delivery: "",
      actual_delivery: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        order_date: initialData.order_date,
        retailer: initialData.retailer,
        order_reference: initialData.order_reference || "",
        subtotal: initialData.subtotal,
        delivery_cost: initialData.delivery_cost,
        dispatch_date: initialData.dispatch_date || "",
        estimated_delivery: initialData.estimated_delivery || "",
        actual_delivery: initialData.actual_delivery || "",
        notes: initialData.notes || "",
      });
    } else {
      form.reset({
        order_date: format(new Date(), "yyyy-MM-dd"),
        retailer: "",
        order_reference: "",
        subtotal: 0,
        delivery_cost: 0,
        dispatch_date: "",
        estimated_delivery: "",
        actual_delivery: "",
        notes: "",
      });
    }
  }, [initialData, form]);

  const watchedSubtotal = form.watch("subtotal");
  const watchedDeliveryCost = form.watch("delivery_cost");
  const totalAmount = (watchedSubtotal || 0) + (watchedDeliveryCost || 0);

  const handleSubmit = (values: OrderFormValues) => {
    onSubmit({
      order_date: values.order_date,
      retailer: values.retailer,
      order_reference: values.order_reference || null,
      subtotal: values.subtotal,
      delivery_cost: values.delivery_cost,
      total_amount: values.subtotal + values.delivery_cost,
      dispatch_date: values.dispatch_date || null,
      estimated_delivery: values.estimated_delivery || null,
      actual_delivery: values.actual_delivery || null,
      transaction_id: initialData?.transaction_id || null,
      notes: values.notes || null,
    });
    onOpenChange(false);
    form.reset();
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {isEditing ? "Edit Order" : "Add Online Order"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Order Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="retailer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retailer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Boots, Superdrug" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="order_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Order Reference (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. ORD-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="subtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="delivery_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Cost (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="text-sm bg-muted/50 p-3 rounded-md">
              <div className="flex justify-between font-medium">
                <span>Total Amount:</span>
                <span>£{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Delivery Tracking</h4>
              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="dispatch_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Dispatched</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="estimated_delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Est. Delivery</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="actual_delivery"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Delivered</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional notes..."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isEditing ? "Update" : "Add"} Order
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
