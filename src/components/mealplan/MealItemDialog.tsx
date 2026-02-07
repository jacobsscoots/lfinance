import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Scale, AlertTriangle, Target, Zap } from "lucide-react";
import { Product, MealEligibility } from "@/hooks/useProducts";
import { MealType, MealPlanItem, useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useNutritionSettings } from "@/hooks/useNutritionSettings";
import { 
  calculateSingleItemPortion, 
  isProductAllowedForMeal,
  PortioningSettings,
  DEFAULT_PORTIONING_SETTINGS 
} from "@/lib/autoPortioning";

interface MealItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  mealType: MealType;
  products: Product[];
  weekStart: Date;
  existingItems?: MealPlanItem[];
  planDate?: Date;
}

export function MealItemDialog({
  open,
  onOpenChange,
  planId,
  mealType,
  products,
  weekStart,
  existingItems = [],
  planDate,
}: MealItemDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("100");
  const [manualOverride, setManualOverride] = useState(false);
  
  const { addItem } = useMealPlanItems(weekStart);
  const { settings, isTargetMode, getTargetsForDate } = useNutritionSettings();

  const selectedProduct = products.find(p => p.id === selectedProductId);
  
  // Check if product is allowed for this meal
  const isAllowedForMeal = selectedProduct 
    ? isProductAllowedForMeal(selectedProduct, mealType)
    : true;

  // Get portioning settings from user settings
  const portioningSettings: PortioningSettings = useMemo(() => ({
    minGrams: settings?.min_grams_per_item ?? DEFAULT_PORTIONING_SETTINGS.minGrams,
    maxGrams: settings?.max_grams_per_item ?? DEFAULT_PORTIONING_SETTINGS.maxGrams,
    rounding: settings?.portion_rounding ?? DEFAULT_PORTIONING_SETTINGS.rounding,
    tolerancePercent: settings?.target_tolerance_percent ?? DEFAULT_PORTIONING_SETTINGS.tolerancePercent,
  }), [settings]);

  // Get daily targets for the plan date
  const dailyTargets = useMemo(() => {
    if (!planDate) return { calories: 2000, protein: 150, carbs: 200, fat: 65 };
    return getTargetsForDate(planDate);
  }, [planDate, getTargetsForDate]);

  // In target mode, items are added with 0g initially
  // User clicks "Generate Portions" to calculate exact grams for all items
  const autoPortionResult = useMemo(() => {
    if (!selectedProduct || !isTargetMode) return null;
    
    return calculateSingleItemPortion(
      selectedProduct,
      mealType,
      existingItems,
      dailyTargets,
      portioningSettings
    );
  }, [selectedProduct, isTargetMode, mealType, existingItems, dailyTargets, portioningSettings]);

  // In target mode, default to 0g (will be calculated later via Generate)
  // In manual mode, default to 100g
  useEffect(() => {
    if (selectedProduct && isTargetMode && !manualOverride) {
      // For fixed products, use their fixed portion
      if (selectedProduct.product_type === "fixed" && selectedProduct.fixed_portion_grams) {
        setQuantity(String(selectedProduct.fixed_portion_grams));
      } else {
        // Otherwise default to 0 - will be calculated via Generate button
        setQuantity("0");
      }
    } else if (selectedProduct && !isTargetMode && !manualOverride) {
      setQuantity("100");
    }
  }, [selectedProduct, isTargetMode, manualOverride]);

  // Reset state when dialog opens/closes or product changes
  useEffect(() => {
    if (!open) {
      setSelectedProductId("");
      setQuantity("100");
      setManualOverride(false);
    }
  }, [open]);

  useEffect(() => {
    setManualOverride(false);
  }, [selectedProductId]);

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

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    if (isTargetMode) {
      setManualOverride(true);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProductId) return;
    
    // Block if product not allowed for this meal
    if (!isAllowedForMeal) return;

    // In target mode, allow 0g (will be calculated via Generate)
    // In manual mode, require > 0
    if (!isTargetMode && effectiveQuantity <= 0) return;

    await addItem.mutateAsync({
      meal_plan_id: planId,
      product_id: selectedProductId,
      meal_type: mealType,
      quantity_grams: effectiveQuantity,
    });

    // Reset form
    setSelectedProductId("");
    setQuantity(isTargetMode ? "0" : "100");
    setManualOverride(false);
    onOpenChange(false);
  };

  const mealLabels: Record<MealType, string> = {
    breakfast: "Breakfast",
    lunch: "Lunch",
    dinner: "Dinner",
    snack: "Snacks",
  };

  // Filter and sort products - show eligible first
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aAllowed = isProductAllowedForMeal(a, mealType);
      const bAllowed = isProductAllowedForMeal(b, mealType);
      if (aAllowed && !bAllowed) return -1;
      if (!aAllowed && bAllowed) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, mealType]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Add to {mealLabels[mealType]}</DialogTitle>
            {isTargetMode && (
              <Badge variant="default" className="ml-2">
                <Target className="h-3 w-3 mr-1" />
                Auto
              </Badge>
            )}
          </div>
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
                  sortedProducts.map(product => {
                    const allowed = isProductAllowedForMeal(product, mealType);
                    return (
                      <SelectItem 
                        key={product.id} 
                        value={product.id}
                        className={!allowed ? "opacity-50" : ""}
                      >
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
                          {!allowed && (
                            <Badge variant="outline" className="text-xs ml-1">
                              Not for {mealLabels[mealType]}
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Show warning if product not allowed for this meal */}
          {selectedProduct && !isAllowedForMeal && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{selectedProduct.name}</strong> is not allowed for {mealLabels[mealType]}. 
                {selectedProduct.meal_eligibility && selectedProduct.meal_eligibility.length > 0 && (
                  <> Allowed meals: {selectedProduct.meal_eligibility.map(m => mealLabels[m as MealType] || m).join(", ")}.</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {selectedProduct && isAllowedForMeal && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Quantity (grams)</Label>
                  {isTargetMode && !selectedProduct.fixed_portion_grams && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Zap className="h-3 w-3 text-primary" />
                      <span>Auto-calculated on Generate</span>
                    </div>
                  )}
                </div>
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
                ) : isTargetMode ? (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      min="0"
                      step={portioningSettings.rounding || 1}
                      placeholder="0 (auto-calculated)"
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave at 0 and click "Generate Portions" after adding all items to auto-calculate exact grams.
                    </p>
                  </div>
                ) : (
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(e.target.value)}
                    min="1"
                    step={portioningSettings.rounding || 1}
                  />
                )}
              </div>

              {/* Auto-portioning warnings */}
              {isTargetMode && autoPortionResult && autoPortionResult.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {autoPortionResult.warnings.map((w, i) => (
                      <div key={i} className="text-sm">{w}</div>
                    ))}
                  </AlertDescription>
                </Alert>
              )}

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
              disabled={
                !selectedProductId || 
                addItem.isPending || 
                !isAllowedForMeal ||
                (!isTargetMode && effectiveQuantity <= 0)
              }
            >
              {isTargetMode && effectiveQuantity === 0 ? "Add (0g)" : "Add Item"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
