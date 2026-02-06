import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Package, Scale } from "lucide-react";
import { Product } from "@/hooks/useProducts";
import { MealType, useMealPlanItems } from "@/hooks/useMealPlanItems";

interface MealItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  mealType: MealType;
  products: Product[];
  weekStart: Date;
}

export function MealItemDialog({
  open,
  onOpenChange,
  planId,
  mealType,
  products,
  weekStart,
}: MealItemDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("100");
  
  const { addItem } = useMealPlanItems(weekStart);

  const selectedProduct = products.find(p => p.id === selectedProductId);

  // For fixed products, use the fixed portion size
  const effectiveQuantity = selectedProduct?.product_type === "fixed" && selectedProduct.fixed_portion_grams
    ? selectedProduct.fixed_portion_grams
    : parseFloat(quantity) || 0;

  // Calculate preview macros
  const previewMacros = selectedProduct ? {
    calories: (selectedProduct.calories_per_100g * effectiveQuantity) / 100,
    protein: (selectedProduct.protein_per_100g * effectiveQuantity) / 100,
    carbs: (selectedProduct.carbs_per_100g * effectiveQuantity) / 100,
    fat: (selectedProduct.fat_per_100g * effectiveQuantity) / 100,
  } : null;

  const handleSubmit = async () => {
    if (!selectedProductId || effectiveQuantity <= 0) return;

    await addItem.mutateAsync({
      meal_plan_id: planId,
      product_id: selectedProductId,
      meal_type: mealType,
      quantity_grams: effectiveQuantity,
    });

    // Reset form
    setSelectedProductId("");
    setQuantity("100");
    onOpenChange(false);
  };

  const mealLabels: Record<MealType, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {mealLabels[mealType]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Product</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {products.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    No products. Add products in Settings first.
                  </div>
                ) : (
                  products.map(product => (
                    <SelectItem key={product.id} value={product.id}>
                      <div className="flex items-center gap-2">
                        {product.product_type === "fixed" ? (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Scale className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>{product.name}</span>
                        <span className="text-muted-foreground">
                          ({product.calories_per_100g} kcal/100g)
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedProduct && (
            <>
              <div className="space-y-2">
                <Label>Quantity (grams)</Label>
                {selectedProduct.product_type === "fixed" && selectedProduct.fixed_portion_grams ? (
                  <div className="flex items-center gap-2">
                    <Input 
                      type="number" 
                      value={selectedProduct.fixed_portion_grams} 
                      disabled 
                      className="bg-muted"
                    />
                    <Badge variant="secondary">
                      <Package className="h-3 w-3 mr-1" />
                      Fixed portion
                    </Badge>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    min="1"
                    step="10"
                  />
                )}
              </div>

              {previewMacros && !selectedProduct.ignore_macros && (
                <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                  <div className="text-sm font-medium">Nutrition Preview</div>
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-semibold">{Math.round(previewMacros.calories)}</div>
                      <div className="text-xs text-muted-foreground">kcal</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{Math.round(previewMacros.protein)}g</div>
                      <div className="text-xs text-muted-foreground">Protein</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{Math.round(previewMacros.carbs)}g</div>
                      <div className="text-xs text-muted-foreground">Carbs</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold">{Math.round(previewMacros.fat)}g</div>
                      <div className="text-xs text-muted-foreground">Fat</div>
                    </div>
                  </div>
                </div>
              )}

              {selectedProduct.ignore_macros && (
                <div className="p-3 rounded-lg bg-muted border border-border text-sm text-muted-foreground">
                  This item ignores macros and will only appear in the grocery list.
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedProductId || effectiveQuantity <= 0 || addItem.isPending}
            >
              Add Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
