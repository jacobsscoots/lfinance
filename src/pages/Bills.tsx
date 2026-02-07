import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Receipt } from "lucide-react";
import { useBills, Bill } from "@/hooks/useBills";
import { BillCard } from "@/components/bills/BillCard";
import { BillFormDialog } from "@/components/bills/BillFormDialog";
import { DeleteBillDialog } from "@/components/bills/DeleteBillDialog";

export default function Bills() {
  const { bills, isLoading } = useBills();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);

  const activeBills = bills.filter((b) => b.is_active);
  const inactiveBills = bills.filter((b) => !b.is_active);

  const totalMonthly = activeBills.reduce((sum, bill) => {
    const amount = Number(bill.amount);
    switch (bill.frequency) {
      case "weekly": return sum + amount * 4.33;
      case "fortnightly": return sum + amount * 2.17;
      case "monthly": return sum + amount;
      case "quarterly": return sum + amount / 3;
      case "yearly": return sum + amount / 12;
      default: return sum + amount;
    }
  }, 0);

  const handleEdit = (bill: Bill) => {
    setSelectedBill(bill);
    setFormOpen(true);
  };

  const handleDelete = (bill: Bill) => {
    setSelectedBill(bill);
    setDeleteOpen(true);
  };

  const handleAddNew = () => {
    setSelectedBill(null);
    setFormOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Bills</h1>
            <p className="text-muted-foreground">
              Manage your recurring bills and subscriptions
            </p>
          </div>
          <Button onClick={handleAddNew}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bill
          </Button>
        </div>

        {/* Summary Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Bills Total</p>
                <p className="text-3xl font-bold">
                  £{totalMonthly.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Active Bills</p>
                <p className="text-2xl font-semibold">{activeBills.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bills List */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-24 mb-4" />
                  <Skeleton className="h-8 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : bills.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Receipt className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No bills yet</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
                Add your recurring bills and subscriptions to track them here.
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Bill
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active ({activeBills.length})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({inactiveBills.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              {activeBills.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No active bills. Click "Add Bill" to create one.
                </p>
              )}
            </TabsContent>
            <TabsContent value="inactive">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {inactiveBills.map((bill) => (
                  <BillCard
                    key={bill.id}
                    bill={bill}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
              {inactiveBills.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No inactive bills.
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BillFormDialog open={formOpen} onOpenChange={setFormOpen} bill={selectedBill} />
      <DeleteBillDialog open={deleteOpen} onOpenChange={setDeleteOpen} bill={selectedBill} />
    </AppLayout>
  );
}
