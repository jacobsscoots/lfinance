import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useToiletries } from "@/hooks/useToiletries";
import { ToiletrySummaryCards } from "@/components/toiletries/ToiletrySummaryCards";
import { ToiletryCategoryFilter } from "@/components/toiletries/ToiletryCategoryFilter";
import { ToiletryTable } from "@/components/toiletries/ToiletryTable";
import { ToiletryFormDialog } from "@/components/toiletries/ToiletryFormDialog";
import { DeleteToiletryDialog } from "@/components/toiletries/DeleteToiletryDialog";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

export default function Toiletries() {
  const { 
    toiletries, 
    isLoading, 
    createToiletry, 
    updateToiletry, 
    deleteToiletry,
    restockToiletry 
  } = useToiletries();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ToiletryItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ToiletryItem | null>(null);
  
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
          <Button onClick={handleAddClick}>
            <Plus className="mr-2 h-4 w-4" />
            Add Item
          </Button>
        </div>
        
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
          />
        )}
        
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
      </div>
    </AppLayout>
  );
}
