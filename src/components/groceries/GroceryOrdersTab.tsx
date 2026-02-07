import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Package, Truck, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useGroceryOrders, GroceryOrder, GroceryOrderFormData } from "@/hooks/useGroceryOrders";
import { RETAILER_OPTIONS } from "@/lib/discounts";

const orderSchema = z.object({
  order_date: z.string().min(1, "Order date is required"),
  retailer: z.string().min(1, "Retailer is required"),
  order_reference: z.string().optional(),
  subtotal: z.coerce.number().min(0),
  delivery_cost: z.coerce.number().min(0).optional(),
  dispatch_date: z.string().optional(),
  estimated_delivery: z.string().optional(),
  actual_delivery: z.string().optional(),
  notes: z.string().optional(),
});

type OrderFormValues = z.infer<typeof orderSchema>;

export function GroceryOrdersTab() {
  const { orders, isLoading, createOrder, updateOrder, deleteOrder } = useGroceryOrders();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<GroceryOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleAdd = () => {
    setEditingOrder(null);
    setDialogOpen(true);
  };

  const handleEdit = (order: GroceryOrder) => {
    setEditingOrder(order);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteOrder.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading orders...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Online Orders</h2>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Order
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No orders yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Track your online grocery orders and delivery times.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onEdit={() => handleEdit(order)}
              onDelete={() => setDeleteConfirmId(order.id)}
            />
          ))}
        </div>
      )}

      <OrderFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        order={editingOrder}
        onCreate={async (data) => { await createOrder.mutateAsync(data); }}
        onUpdate={async (id, data) => { await updateOrder.mutateAsync({ id, ...data }); }}
      />

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete order?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this order record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrderCard({
  order,
  onEdit,
  onDelete,
}: {
  order: GroceryOrder;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const getStatus = () => {
    if (order.actual_delivery) return { label: "Delivered", variant: "default" as const };
    if (order.dispatch_date) return { label: "Dispatched", variant: "secondary" as const };
    return { label: "Pending", variant: "outline" as const };
  };

  const status = getStatus();

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{order.retailer}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              {format(new Date(order.order_date), "d MMM yyyy")}
              {order.order_reference && ` • #${order.order_reference}`}
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span>Subtotal: £{order.subtotal.toFixed(2)}</span>
              {order.delivery_cost !== null && order.delivery_cost > 0 && (
                <span className="text-muted-foreground">
                  Delivery: £{order.delivery_cost.toFixed(2)}
                </span>
              )}
              <span className="font-medium">Total: £{order.total_amount.toFixed(2)}</span>
            </div>
            {order.estimated_delivery && !order.actual_delivery && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Truck className="h-3 w-3" />
                Est. {format(new Date(order.estimated_delivery), "d MMM")}
              </div>
            )}
            {order.actual_delivery && (
              <div className="flex items-center gap-1 text-sm text-primary">
                <Check className="h-3 w-3" />
                Delivered {format(new Date(order.actual_delivery), "d MMM")}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onEdit}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderFormDialog({
  open,
  onOpenChange,
  order,
  onCreate,
  onUpdate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: GroceryOrder | null;
  onCreate: (data: GroceryOrderFormData) => Promise<unknown>;
  onUpdate: (id: string, data: GroceryOrderFormData) => Promise<unknown>;
}) {
  const isEditing = !!order;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      order_date: order?.order_date || format(new Date(), "yyyy-MM-dd"),
      retailer: order?.retailer || "",
      order_reference: order?.order_reference || "",
      subtotal: order?.subtotal || 0,
      delivery_cost: order?.delivery_cost || 0,
      dispatch_date: order?.dispatch_date || "",
      estimated_delivery: order?.estimated_delivery || "",
      actual_delivery: order?.actual_delivery || "",
      notes: order?.notes || "",
    },
  });

  // Reset form when order changes
  useState(() => {
    if (order) {
      form.reset({
        order_date: order.order_date,
        retailer: order.retailer,
        order_reference: order.order_reference || "",
        subtotal: order.subtotal,
        delivery_cost: order.delivery_cost || 0,
        dispatch_date: order.dispatch_date || "",
        estimated_delivery: order.estimated_delivery || "",
        actual_delivery: order.actual_delivery || "",
        notes: order.notes || "",
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
  });

  async function onSubmit(values: OrderFormValues) {
    const data: GroceryOrderFormData = {
      order_date: values.order_date,
      retailer: values.retailer,
      order_reference: values.order_reference || null,
      subtotal: values.subtotal,
      delivery_cost: values.delivery_cost || 0,
      total_amount: values.subtotal + (values.delivery_cost || 0),
      dispatch_date: values.dispatch_date || null,
      estimated_delivery: values.estimated_delivery || null,
      actual_delivery: values.actual_delivery || null,
      notes: values.notes || null,
    };

    if (isEditing && order) {
      await onUpdate(order.id, data);
    } else {
      await onCreate(data);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Order" : "Add Order"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RETAILER_OPTIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Order Reference</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. MP123456" {...field} />
                  </FormControl>
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
                      <Input type="number" step="0.01" {...field} />
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
                    <FormLabel>Delivery (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="dispatch_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispatched</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimated_delivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Est. Delivery</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="actual_delivery"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivered</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {isEditing ? "Save" : "Add Order"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
