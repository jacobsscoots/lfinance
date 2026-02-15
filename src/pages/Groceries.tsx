import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Package, BarChart3, Scale, Sparkles, Plus, WashingMachine } from "lucide-react";
import { ShopReadyListView } from "@/components/groceries/ShopReadyList";
import { GroceryOrdersTab } from "@/components/groceries/GroceryOrdersTab";
import { GrocerySummaryTab } from "@/components/groceries/GrocerySummaryTab";
import { WeighStockDialog } from "@/components/groceries/WeighStockDialog";
import { useProducts } from "@/hooks/useProducts";

// Toiletries imports
import { useToiletries } from "@/hooks/useToiletries";
import { useToiletryPurchases } from "@/hooks/useToiletryPurchases";
import { useToiletryUsageLogs } from "@/hooks/useToiletryUsageLogs";
import { useRetailerProfiles } from "@/hooks/useRetailerProfiles";
import { calculateDailyUsageFromLogs } from "@/lib/reorderCalculations";
import { ToiletrySummaryCards } from "@/components/toiletries/ToiletrySummaryCards";
import { ToiletryCategoryFilter } from "@/components/toiletries/ToiletryCategoryFilter";
import { ToiletryTable } from "@/components/toiletries/ToiletryTable";
import { ToiletryFormDialog } from "@/components/toiletries/ToiletryFormDialog";
import { DeleteToiletryDialog } from "@/components/toiletries/DeleteToiletryDialog";
import { LogWeightDialog } from "@/components/toiletries/LogWeightDialog";
import { LinkPurchaseDialog } from "@/components/toiletries/LinkPurchaseDialog";
import { PriceComparisonDialog } from "@/components/toiletries/PriceComparisonDialog";
import { OrdersPanel } from "@/components/toiletries/OrdersPanel";
import { WeighToiletriesDialog } from "@/components/toiletries/WeighToiletriesDialog";
import { OnHandPanel } from "@/components/toiletries/OnHandPanel";
import type { ToiletryItem } from "@/lib/toiletryCalculations";
import type { ShippingProfile } from "@/lib/reorderCalculations";

export default function Groceries() {
  const [activeTab, setActiveTab] = useState("shop-list");
  const [weighDialogOpen, setWeighDialogOpen] = useState(false);
  const { products } = useProducts();

  // ── Shared toiletries/laundry state ──
  const {
    toiletries: allItems,
    isLoading: toilLoading,
    createToiletry,
    updateToiletry,
    deleteToiletry,
    restockToiletry,
    logWeight,
  } = useToiletries();
  const { purchases, createPurchase } = useToiletryPurchases();
  const { logs: allUsageLogs } = useToiletryUsageLogs();
  const { profiles } = useRetailerProfiles();

  // Split by section
  const toiletries = useMemo(() => allItems.filter(i => (i.section || "toiletry") === "toiletry"), [allItems]);
  const laundryItems = useMemo(() => allItems.filter(i => i.section === "laundry"), [allItems]);

  const usageRates = useMemo(() => {
    const rates: Record<string, number | null> = {};
    for (const item of allItems) {
      const itemLogs = allUsageLogs.filter((l) => l.toiletry_item_id === item.id);
      const result = calculateDailyUsageFromLogs(
        itemLogs.map((l) => ({ logged_date: l.logged_date, amount_used: l.amount_used }))
      );
      rates[item.id] = result.dailyUsage;
    }
    return rates;
  }, [allItems, allUsageLogs]);

  const shippingProfiles = useMemo(() => {
    const map: Record<string, ShippingProfile | null> = {};
    for (const p of profiles) {
      map[p.retailer_name.toLowerCase()] = {
        dispatch_days_min: p.dispatch_days_min,
        dispatch_days_max: p.dispatch_days_max,
        delivery_days_min: p.delivery_days_min,
        delivery_days_max: p.delivery_days_max,
        dispatches_weekends: p.dispatches_weekends,
        delivers_weekends: p.delivers_weekends,
        cutoff_time: p.cutoff_time,
      };
    }
    return map;
  }, [profiles]);

  // ── Shared dialog state ──
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [laundryCategory, setLaundryCategory] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formSection, setFormSection] = useState<"toiletry" | "laundry">("toiletry");
  const [editingItem, setEditingItem] = useState<ToiletryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ToiletryItem | null>(null);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weighingItem, setWeighingItem] = useState<ToiletryItem | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [linkingItem, setLinkingItem] = useState<ToiletryItem | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [pricingItem, setPricingItem] = useState<ToiletryItem | null>(null);
  const [weighToiletriesOpen, setWeighToiletriesOpen] = useState(false);

  const filteredToiletries = useMemo(() => {
    if (!selectedCategory) return toiletries;
    return toiletries.filter((item) => item.category === selectedCategory);
  }, [toiletries, selectedCategory]);

  const filteredLaundry = useMemo(() => {
    if (!laundryCategory) return laundryItems;
    return laundryItems.filter((item) => item.category === laundryCategory);
  }, [laundryItems, laundryCategory]);

  const openAddForm = (section: "toiletry" | "laundry") => {
    setEditingItem(null);
    setFormSection(section);
    setFormDialogOpen(true);
  };
  const handleEdit = (item: ToiletryItem) => {
    setEditingItem(item);
    setFormSection((item.section as "toiletry" | "laundry") || "toiletry");
    setFormDialogOpen(true);
  };
  const handleDelete = (item: ToiletryItem) => { setDeletingItem(item); setDeleteDialogOpen(true); };
  const handleRestock = (item: ToiletryItem) => { restockToiletry.mutate({ id: item.id, totalSize: item.total_size }); };
  const handleLogWeight = (item: ToiletryItem) => { setWeighingItem(item); setWeightDialogOpen(true); };
  const handleLinkPurchase = (item: ToiletryItem) => { setLinkingItem(item); setPurchaseDialogOpen(true); };
  const handleFindPrices = (item: ToiletryItem) => { setPricingItem(item); setPriceDialogOpen(true); };

  const handleFormSubmit = (values: any) => {
    if (editingItem) {
      updateToiletry.mutate({ id: editingItem.id, ...values });
    } else {
      createToiletry.mutate(values);
    }
  };
  const handleDeleteConfirm = () => {
    if (deletingItem) {
      deleteToiletry.mutate(deletingItem.id);
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    }
  };
  const handleWeightSubmit = (itemId: string, weight: number, readingType: "full" | "regular" | "empty") => {
    logWeight.mutate({ id: itemId, weight, readingType });
  };
  const handlePurchaseSubmit = (values: {
    toiletry_item_id: string;
    transaction_id: string | null;
    purchase_date: string;
    quantity: number;
    unit_price: number;
    discount_type: string;
    discount_amount: number;
    final_price: number;
    notes: string | null;
  }) => {
    createPurchase.mutate({ ...values, order_id: null });
  };

  // Dynamic header actions based on active tab
  const headerActions = () => {
    if (activeTab === "toiletries") {
      return (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWeighToiletriesOpen(true)}>
            <Scale className="mr-2 h-4 w-4" />
            Weigh What I Have
          </Button>
          <Button onClick={() => openAddForm("toiletry")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      );
    }
    if (activeTab === "laundry") {
      return (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setWeighToiletriesOpen(true)}>
            <Scale className="mr-2 h-4 w-4" />
            Weigh What I Have
          </Button>
          <Button onClick={() => openAddForm("laundry")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
      );
    }
    return (
      <Button variant="outline" onClick={() => setWeighDialogOpen(true)}>
        <Scale className="mr-2 h-4 w-4" />
        Weigh What I Have
      </Button>
    );
  };

  // Items for weigh dialog — scoped to active section
  const weighItems = activeTab === "laundry" ? laundryItems : toiletries;

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Groceries & Toiletries</h1>
            <p className="text-muted-foreground">
              Track your weekly grocery spending and consumables
            </p>
          </div>
          {headerActions()}
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
            <TabsTrigger value="toiletries" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Toiletries</span>
            </TabsTrigger>
            <TabsTrigger value="laundry" className="flex items-center gap-2">
              <WashingMachine className="h-4 w-4" />
              <span className="hidden sm:inline">Laundry</span>
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

          <TabsContent value="toiletries" className="mt-4">
            <div className="space-y-6">
              <OrdersPanel />
              <OnHandPanel items={toiletries} usageRates={usageRates} shippingProfiles={shippingProfiles} />
              <ToiletrySummaryCards items={toiletries} />
              <ToiletryCategoryFilter selectedCategory={selectedCategory} onCategoryChange={setSelectedCategory} section="toiletry" />
              {toilLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading items...</div>
              ) : (
                <ToiletryTable
                  items={filteredToiletries}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestock={handleRestock}
                  onLogWeight={handleLogWeight}
                  onLinkPurchase={handleLinkPurchase}
                  onFindPrices={handleFindPrices}
                  usageRates={usageRates}
                  shippingProfiles={shippingProfiles}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="laundry" className="mt-4">
            <div className="space-y-6">
              <OnHandPanel items={laundryItems} usageRates={usageRates} shippingProfiles={shippingProfiles} />
              <ToiletrySummaryCards items={laundryItems} />
              <ToiletryCategoryFilter selectedCategory={laundryCategory} onCategoryChange={setLaundryCategory} section="laundry" />
              {toilLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading items...</div>
              ) : (
                <ToiletryTable
                  items={filteredLaundry}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onRestock={handleRestock}
                  onLogWeight={handleLogWeight}
                  onLinkPurchase={handleLinkPurchase}
                  onFindPrices={handleFindPrices}
                  usageRates={usageRates}
                  shippingProfiles={shippingProfiles}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Grocery dialogs */}
        <WeighStockDialog open={weighDialogOpen} onOpenChange={setWeighDialogOpen} products={products} />

        {/* Shared toiletry/laundry dialogs */}
        <ToiletryFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          onSubmit={handleFormSubmit}
          initialData={editingItem}
          isLoading={createToiletry.isPending || updateToiletry.isPending}
          section={formSection}
        />
        <DeleteToiletryDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          itemName={deletingItem?.name || ""}
          isLoading={deleteToiletry.isPending}
        />
        <LogWeightDialog
          open={weightDialogOpen}
          onOpenChange={setWeightDialogOpen}
          item={weighingItem}
          onSubmit={handleWeightSubmit}
          isLoading={logWeight.isPending}
        />
        <LinkPurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          item={linkingItem}
          onSubmit={handlePurchaseSubmit}
          isLoading={createPurchase.isPending}
        />
        <PriceComparisonDialog
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          item={pricingItem}
        />
        <WeighToiletriesDialog
          open={weighToiletriesOpen}
          onOpenChange={setWeighToiletriesOpen}
          items={weighItems}
        />
      </div>
    </AppLayout>
  );
}
