import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Package, BarChart3 } from "lucide-react";
import { ShopReadyListView } from "@/components/groceries/ShopReadyList";
import { GroceryOrdersTab } from "@/components/groceries/GroceryOrdersTab";
import { GrocerySummaryTab } from "@/components/groceries/GrocerySummaryTab";

export default function Groceries() {
  const [activeTab, setActiveTab] = useState("shop-list");

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Grocery Budget</h1>
          <p className="text-muted-foreground">
            Track your weekly grocery spending and shop smart
          </p>
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
      </div>
    </AppLayout>
  );
}
