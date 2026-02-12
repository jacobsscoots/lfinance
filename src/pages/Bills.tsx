import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Receipt, CreditCard, Tv, Upload, ShoppingCart } from "lucide-react";
import { ExcelImportDialog } from "@/components/settings/ExcelImportDialog";
import { useBills, Bill } from "@/hooks/useBills";
import { useGroceryForecast } from "@/hooks/useGroceryForecast";
import { BillListItem } from "@/components/bills/BillListItem";
import { BillFormDialog } from "@/components/bills/BillFormDialog";
import { DeleteBillDialog } from "@/components/bills/DeleteBillDialog";
import { DailyBudgetCard } from "@/components/bills/DailyBudgetCard";

export default function Bills() {
  const { bills, isLoading } = useBills();
  const { weeklySpend: groceryWeekly, monthlySpend: groceryMonthly } = useGroceryForecast();
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [activeTab, setActiveTab] = useState<"bills" | "subscriptions">("bills");
  const [importOpen, setImportOpen] = useState(false);

  // Separate bills from subscriptions
  const allActiveBills = bills.filter((b) => b.is_active);
  const allInactiveBills = bills.filter((b) => !b.is_active);
  
  const subscriptions = allActiveBills.filter((b) => (b as any).is_subscription === true);
  const regularBills = allActiveBills.filter((b) => (b as any).is_subscription !== true);
  const inactiveSubscriptions = allInactiveBills.filter((b) => (b as any).is_subscription === true);
  const inactiveRegularBills = allInactiveBills.filter((b) => (b as any).is_subscription !== true);

  const displayedActive = activeTab === "subscriptions" ? subscriptions : regularBills;
  const displayedInactive = activeTab === "subscriptions" ? inactiveSubscriptions : inactiveRegularBills;

  const totalMonthly = allActiveBills.reduce((sum, bill) => {
    const amount = Number(bill.amount);
    switch (bill.frequency) {
      case "daily": return sum + amount * 30;
      case "weekly": return sum + amount * 4.33;
      case "fortnightly": return sum + amount * 2.17;
      case "monthly": return sum + amount;
      case "bimonthly": return sum + amount / 2;
      case "quarterly": return sum + amount / 3;
      case "biannual": return sum + amount / 6;
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Import Excel
            </Button>
            <Button onClick={handleAddNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
        </div>

        {/* Daily Budget Tracker */}
        <DailyBudgetCard />

        {/* Grocery Forecast */}
        {groceryMonthly > 0 && (
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Grocery Forecast</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-xl font-bold">£{groceryMonthly.toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
                    <span className="text-sm text-muted-foreground">£{groceryWeekly.toFixed(2)}/wk</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground max-w-[140px] text-right">Based on meal plan needs minus stock on hand</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Card */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Monthly Bills Total</p>
                <p className="text-3xl font-bold">
                  £{totalMonthly.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="flex gap-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <CreditCard className="h-4 w-4" />
                    <span className="text-sm">Bills</span>
                  </div>
                  <p className="text-xl font-semibold">{regularBills.length}</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Tv className="h-4 w-4" />
                    <span className="text-sm">Subscriptions</span>
                  </div>
                  <p className="text-xl font-semibold">{subscriptions.length}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bills / Subscriptions Tabs */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 rounded-lg border">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-6 w-20" />
              </div>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "bills" | "subscriptions")}>
            <TabsList className="mb-4">
              <TabsTrigger value="bills" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Bills ({regularBills.length})
              </TabsTrigger>
              <TabsTrigger value="subscriptions" className="gap-2">
                <Tv className="h-4 w-4" />
                Subscriptions ({subscriptions.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              {/* Active Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">
                  Active ({displayedActive.length})
                </h3>
                {displayedActive.length > 0 ? (
                  <div className="space-y-2">
                    {displayedActive.map((bill) => (
                      <BillListItem
                        key={bill.id}
                        bill={bill}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No active {activeTab === "subscriptions" ? "subscriptions" : "bills"}.
                  </p>
                )}
              </div>

              {/* Inactive Section */}
              {displayedInactive.length > 0 && (
                <div className="space-y-2 pt-4 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground px-1">
                    Inactive ({displayedInactive.length})
                  </h3>
                  <div className="space-y-2">
                    {displayedInactive.map((bill) => (
                      <BillListItem
                        key={bill.id}
                        bill={bill}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>

      <BillFormDialog open={formOpen} onOpenChange={setFormOpen} bill={selectedBill} />
      <DeleteBillDialog open={deleteOpen} onOpenChange={setDeleteOpen} bill={selectedBill} />
      <ExcelImportDialog open={importOpen} onOpenChange={setImportOpen} initialSection="bills" />
    </AppLayout>
  );
}
