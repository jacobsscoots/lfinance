import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Scale } from "lucide-react";
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
import { OrdersTab } from "@/components/toiletries/OrdersTab";
import { OrdersPanel } from "@/components/toiletries/OrdersPanel";
import { ToiletrySummaryTab } from "@/components/toiletries/ToiletrySummaryTab";
import { WeighToiletriesDialog } from "@/components/toiletries/WeighToiletriesDialog";
import { OnHandPanel } from "@/components/toiletries/OnHandPanel";
import type { ToiletryItem } from "@/lib/toiletryCalculations";
import type { ShippingProfile } from "@/lib/reorderCalculations";

export default function Toiletries() {
  const { 
    toiletries, 
    isLoading, 
    createToiletry, 
    updateToiletry, 
    deleteToiletry,
    restockToiletry,
    logWeight,
  } = useToiletries();
  
  const { purchases, createPurchase } = useToiletryPurchases();
  const { logs: allUsageLogs } = useToiletryUsageLogs();
  const { profiles, getProfileForRetailer } = useRetailerProfiles();
  
  // Compute per-item usage rates from logs
  const usageRates = useMemo(() => {
    const rates: Record<string, number | null> = {};
    for (const item of toiletries) {
      const itemLogs = allUsageLogs.filter((l) => l.toiletry_item_id === item.id);
      const result = calculateDailyUsageFromLogs(
        itemLogs.map((l) => ({ logged_date: l.logged_date, amount_used: l.amount_used }))
      );
      rates[item.id] = result.dailyUsage;
    }
    return rates;
  }, [toiletries, allUsageLogs]);

  // Build shipping profile lookup by retailer name (lowercase)
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

  const [activeTab, setActiveTab] = useState("items");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ToiletryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ToiletryItem | null>(null);
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weighingItem, setWeighingItem] = useState<ToiletryItem | null>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [linkingItem, setLinkingItem] = useState<ToiletryItem | null>(null);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [pricingItem, setPricingItem] = useState<ToiletryItem | null>(null);
  const [weighDialogOpen, setWeighDialogOpen] = useState(false);
  
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return toiletries;
    return toiletries.filter(item => item.category === selectedCategory);
  }, [toiletries, selectedCategory]);
  
  const handleAddClick = () => {
    setEditingItem(null);
    setFormDialogOpen(true);
  };
  
  const handleEdit = (item: ToiletryItem) => {
    setEditingItem(item);
    setFormDialogOpen(true);
  };
  
  const handleDelete = (item: ToiletryItem) => {
    setDeletingItem(item);
    setDeleteDialogOpen(true);
  };
  
  const handleRestock = (item: ToiletryItem) => {
    restockToiletry.mutate({ id: item.id, totalSize: item.total_size });
  };
  
  const handleLogWeight = (item: ToiletryItem) => {
    setWeighingItem(item);
    setWeightDialogOpen(true);
  };
  
  const handleLinkPurchase = (item: ToiletryItem) => {
    setLinkingItem(item);
    setPurchaseDialogOpen(true);
  };
  
  const handleFindPrices = (item: ToiletryItem) => {
    setPricingItem(item);
    setPriceDialogOpen(true);
  };
  
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
    createPurchase.mutate({
      ...values,
      order_id: null,
    });
  };
  
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Toiletries</h1>
            <p className="text-muted-foreground">
              Track and forecast your consumables
            </p>
          </div>
          <Button variant="outline" onClick={() => setWeighDialogOpen(true)}>
            <Scale className="mr-2 h-4 w-4" />
            Weigh What I Have
          </Button>
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="items">Items</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="summary">Summary</TabsTrigger>
          </TabsList>
          
          <TabsContent value="items" className="space-y-6">
            {/* Orders Panel (inline at top) */}
            <OrdersPanel />

            {/* On Hand Panel */}
            <OnHandPanel
              items={toiletries}
              usageRates={usageRates}
              shippingProfiles={shippingProfiles}
            />

            {/* Summary Cards */}
            <ToiletrySummaryCards items={toiletries} />
            
            {/* Category Filter */}
            <ToiletryCategoryFilter
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
            
            {/* Items Table */}
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Loading items...
              </div>
            ) : (
              <ToiletryTable
                items={filteredItems}
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
          </TabsContent>
          
          <TabsContent value="orders">
            <OrdersTab />
          </TabsContent>
          
          <TabsContent value="summary">
            <ToiletrySummaryTab items={toiletries} purchases={purchases} />
          </TabsContent>
        </Tabs>
        
        {/* Form Dialog */}
        <ToiletryFormDialog
          open={formDialogOpen}
          onOpenChange={setFormDialogOpen}
          onSubmit={handleFormSubmit}
          initialData={editingItem}
          isLoading={createToiletry.isPending || updateToiletry.isPending}
        />
        
        {/* Delete Dialog */}
        <DeleteToiletryDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          itemName={deletingItem?.name || ""}
          isLoading={deleteToiletry.isPending}
        />
        
        {/* Weight Dialog */}
        <LogWeightDialog
          open={weightDialogOpen}
          onOpenChange={setWeightDialogOpen}
          item={weighingItem}
          onSubmit={handleWeightSubmit}
          isLoading={logWeight.isPending}
        />
        
        {/* Purchase Dialog */}
        <LinkPurchaseDialog
          open={purchaseDialogOpen}
          onOpenChange={setPurchaseDialogOpen}
          item={linkingItem}
          onSubmit={handlePurchaseSubmit}
          isLoading={createPurchase.isPending}
        />
        
        {/* Price Comparison Dialog */}
        <PriceComparisonDialog
          open={priceDialogOpen}
          onOpenChange={setPriceDialogOpen}
          item={pricingItem}
        />
        
        {/* Weigh What I Have Dialog */}
        <WeighToiletriesDialog
          open={weighDialogOpen}
          onOpenChange={setWeighDialogOpen}
          items={toiletries}
        />
      </div>
    </AppLayout>
  );
}
