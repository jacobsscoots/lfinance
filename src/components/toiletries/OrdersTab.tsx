import { useState } from "react";
import { format } from "date-fns";
import { Plus, Package, Truck, CheckCircle, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OrderFormDialog } from "./OrderFormDialog";
import { useToiletryOrders, type ToiletryOrder } from "@/hooks/useToiletryOrders";
import { formatCurrency } from "@/lib/toiletryCalculations";

export function OrdersTab() {
  const { orders, isLoading, createOrder, updateOrder, deleteOrder } = useToiletryOrders();
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<ToiletryOrder | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingOrder, setDeletingOrder] = useState<ToiletryOrder | null>(null);

  const handleAddClick = () => {
    setEditingOrder(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (order: ToiletryOrder) => {
    setEditingOrder(order);
    setFormDialogOpen(true);
  };

  const handleDelete = (order: ToiletryOrder) => {
    setDeletingOrder(order);
    setDeleteDialogOpen(true);
  };

  const handleFormSubmit = (values: Omit<ToiletryOrder, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (editingOrder) {
      updateOrder.mutate({ id: editingOrder.id, ...values });
    } else {
      createOrder.mutate(values);
    }
  };

  const handleDeleteConfirm = () => {
    if (deletingOrder) {
      deleteOrder.mutate(deletingOrder.id);
      setDeleteDialogOpen(false);
      setDeletingOrder(null);
    }
  };

  const getDeliveryStatus = (order: ToiletryOrder) => {
    if (order.actual_delivery) {
      return { label: "Delivered", variant: "default" as const, icon: CheckCircle };
    }
    if (order.dispatch_date) {
      return { label: "In Transit", variant: "secondary" as const, icon: Truck };
    }
    return { label: "Processing", variant: "outline" as const, icon: Package };
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading orders...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Order
        </Button>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No online orders recorded yet.</p>
            <p className="text-sm text-muted-foreground">
              Track your online toiletry orders and delivery status.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const status = getDeliveryStatus(order);
            const StatusIcon = status.icon;

            return (
              <Card key={order.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{order.retailer}</h3>
                        <Badge variant={status.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Ordered {format(new Date(order.order_date), "d MMM yyyy")}
                        {order.order_reference && ` • Ref: ${order.order_reference}`}
                      </p>
                      <div className="flex items-center gap-4 text-sm">
                        <span>Subtotal: {formatCurrency(order.subtotal)}</span>
                        {order.delivery_cost > 0 && (
                          <span className="text-muted-foreground">
                            Delivery: {formatCurrency(order.delivery_cost)}
                          </span>
                        )}
                        <span className="font-medium">
                          Total: {formatCurrency(order.total_amount)}
                        </span>
                      </div>
                      {order.notes && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {order.notes}
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => handleEdit(order)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(order)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Delivery Timeline */}
                  {(order.dispatch_date || order.estimated_delivery || order.actual_delivery) && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex items-center gap-6 text-sm">
                        {order.dispatch_date && (
                          <div>
                            <span className="text-muted-foreground">Dispatched:</span>{" "}
                            {format(new Date(order.dispatch_date), "d MMM")}
                          </div>
                        )}
                        {order.estimated_delivery && !order.actual_delivery && (
                          <div>
                            <span className="text-muted-foreground">Expected:</span>{" "}
                            {format(new Date(order.estimated_delivery), "d MMM")}
                          </div>
                        )}
                        {order.actual_delivery && (
                          <div className="text-primary">
                            <span>Delivered:</span>{" "}
                            {format(new Date(order.actual_delivery), "d MMM")}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <OrderFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onSubmit={handleFormSubmit}
        initialData={editingOrder}
        isLoading={createOrder.isPending || updateOrder.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this order from {deletingOrder?.retailer}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
