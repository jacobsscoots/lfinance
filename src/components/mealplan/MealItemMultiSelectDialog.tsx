import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Package, Scale, Target, ChevronDown, Check } from "lucide-react";
import { Product } from "@/hooks/useProducts";
import { MealType, MealPlanItem, useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useNutritionSettings } from "@/hooks/useNutritionSettings";
import { isProductAllowedForMeal } from "@/lib/autoPortioning";
import { shouldCapAsSeasoning, DEFAULT_SEASONING_MAX_GRAMS, DEFAULT_SEASONING_FALLBACK_GRAMS } from "@/lib/seasoningRules";
import { cn } from "@/lib/utils";

interface MealItemMultiSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  mealType: MealType;
  products: Product[];
  weekStart: Date;
  existingItems?: MealPlanItem[];
}

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export function MealItemMultiSelectDialog({
  open,
  onOpenChange,
  planId,
  mealType,
  products,
  weekStart,
  existingItems = [],
}: MealItemMultiSelectDialogProps) {
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { addMultipleItems } = useMealPlanItems(weekStart);
  const { isTargetMode } = useNutritionSettings();

  // Filter and sort products - show eligible first, then by name
  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const aAllowed = isProductAllowedForMeal(a, mealType);
      const bAllowed = isProductAllowedForMeal(b, mealType);
      if (aAllowed && !bAllowed) return -1;
      if (!aAllowed && bAllowed) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, mealType]);

  // Get IDs of products already in this meal
  const existingProductIds = useMemo(() => {
    return new Set(
      existingItems
        .filter(item => item.meal_type === mealType)
        .map(item => item.product_id)
    );
  }, [existingItems, mealType]);

  const toggleProduct = (productId: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedProductIds.size === 0) return;

    setIsSubmitting(true);
    try {
      const selectedProducts = products.filter(p => selectedProductIds.has(p.id));
      
      const items = selectedProducts.map(product => {
        // Check if this product is a seasoning
        const isSeasoning = shouldCapAsSeasoning(product.food_type, product.name, product.food_type);
        
        // For fixed products, use fixed portion; 
        // For seasonings, use fallback (5g) clamped to max (15g)
        // Otherwise 0 in target mode, 100 in manual
        let quantity = 100;
        if (product.product_type === "fixed" && product.fixed_portion_grams) {
          quantity = product.fixed_portion_grams;
        } else if (isSeasoning) {
          // Seasonings default to 0 — solver calculates proportionally to protein
          quantity = 0;
        } else if (isTargetMode) {
          quantity = 0;
        }

        return {
          meal_plan_id: planId,
          product_id: product.id,
          meal_type: mealType,
          quantity_grams: quantity,
        };
      });

      await addMultipleItems.mutateAsync(items);

      // Reset and close
      setSelectedProductIds(new Set());
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedProductIds(new Set());
    }
    onOpenChange(newOpen);
  };

  const selectedCount = selectedProductIds.size;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Add to {MEAL_LABELS[mealType]}</DialogTitle>
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
            <label className="text-sm font-medium">Products</label>
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={popoverOpen}
                  className="w-full justify-between"
                >
                  {selectedCount > 0
                    ? `${selectedCount} product${selectedCount > 1 ? "s" : ""} selected`
                    : "Select products..."}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search products..." />
                  <CommandList className="max-h-64">
                    <CommandEmpty>No products found.</CommandEmpty>
                    <CommandGroup>
                      {sortedProducts.map(product => {
                        const isAllowed = isProductAllowedForMeal(product, mealType);
                        const isSelected = selectedProductIds.has(product.id);
                        const alreadyExists = existingProductIds.has(product.id);

                        return (
                          <CommandItem
                            key={product.id}
                            value={product.name}
                            onSelect={() => {
                              if (isAllowed && !alreadyExists) {
                                toggleProduct(product.id);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-2",
                              (!isAllowed || alreadyExists) && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <Checkbox
                              checked={isSelected}
                              disabled={!isAllowed || alreadyExists}
                              className="pointer-events-none"
                            />
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {product.product_type === "fixed" ? (
                                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span className="truncate">{product.name}</span>
                              <span className="text-muted-foreground text-xs shrink-0">
                                ({product.calories_per_100g} kcal/100g)
                              </span>
                            </div>
                            {alreadyExists && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Added
                              </Badge>
                            )}
                            {!isAllowed && !alreadyExists && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                Not for {MEAL_LABELS[mealType]}
                              </Badge>
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedCount > 0 && (
            <div className="text-sm text-muted-foreground">
              Selected: {selectedCount} product{selectedCount > 1 ? "s" : ""}
              {isTargetMode && (
                <span className="block text-xs mt-1">
                  Items will be added with 0g — click "Generate Portions" to calculate exact amounts.
                </span>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={selectedCount === 0 || isSubmitting}
            >
              {isSubmitting
                ? "Adding..."
                : isTargetMode
                  ? `Add ${selectedCount} Item${selectedCount !== 1 ? "s" : ""} (0g)`
                  : `Add ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
