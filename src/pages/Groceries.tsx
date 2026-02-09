import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, BarChart3, Scale } from "lucide-react";
import { ShopReadyListView } from "@/components/groceries/ShopReadyList";
import { GroceryOrdersTab } from "@/components/groceries/GroceryOrdersTab";
import { GrocerySummaryTab } from "@/components/groceries/GrocerySummaryTab";
import { WeighStockDialog } from "@/components/groceries/WeighStockDialog";
import { useProducts } from "@/hooks/useProducts";

export default function Groceries() {
  const [activeTab, setActiveTab] = useState("shop-list");
  const [weighDialogOpen, setWeighDialogOpen] = useState(false);
  const { products } = useProducts();

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Grocery Budget</h1>
            <p className="text-muted-foreground">
              Track your weekly grocery spending and shop smart
            </p>
          </div>
          <Button variant="outline" onClick={() => setWeighDialogOpen(true)}>
            <Scale className="mr-2 h-4 w-4" />
            Weigh What I Have
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="shop-list" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span className="hidden sm:inline">Shop List</span>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Summary</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="shop-list" className="mt-4">
            <ShopReadyListView />
          </TabsContent>

          <TabsContent value="orders" className="mt-4">
            <GroceryOrdersTab />
          </TabsContent>

          <TabsContent value="summary" className="mt-4">
            <GrocerySummaryTab />
          </TabsContent>
        </Tabs>

        <WeighStockDialog
          open={weighDialogOpen}
          onOpenChange={setWeighDialogOpen}
          products={products}
        />
      </div>
    </AppLayout>
  );
}
