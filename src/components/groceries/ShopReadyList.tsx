import { useState, useMemo } from "react";
import { format, endOfWeek, addWeeks } from "date-fns";
import { getSmartWeekStart } from "@/lib/smartWeekStart";
import { ChevronLeft, ChevronRight, ShoppingCart, PackageCheck, RefreshCw, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useMealPlanItems } from "@/hooks/useMealPlanItems";
import { useProducts } from "@/hooks/useProducts";
import { useShopListCollected } from "@/hooks/useShopListCollected";
import { generateShopReadyList, ShopReadyList } from "@/lib/groceryListCalculations";
import { DiscountType } from "@/lib/discounts";
import { RetailerSection } from "./RetailerSection";
import { EasySaverCalculator } from "./EasySaverCalculator";
import { toast } from "sonner";

export function ShopReadyListView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [retailerDiscounts, setRetailerDiscounts] = useState<Record<string, DiscountType>>({});
  
  const smartDefault = getSmartWeekStart();
  const weekStart = addWeeks(smartDefault, weekOffset);
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  
  const { mealPlans, isLoading: plansLoading } = useMealPlanItems(weekStart);
  const { products, isLoading: productsLoading } = useProducts();
  const { collectedIds, toggleCollected, resetAll } = useShopListCollected(weekStart);
  
  const shopList = useMemo<ShopReadyList>(() => {
    if (mealPlans.length === 0 || products.length === 0) {
      return {
        byRetailer: [],
        alreadyCovered: [],
        totals: { 
          grossCost: 0, 
          multiBuyDiscount: 0,
          loyaltyDiscount: 0,
          totalDiscount: 0, 
          deliveryCharges: 0,
          finalCost: 0, 
          itemCount: 0 
        },
      };
    }
    return generateShopReadyList(mealPlans, products, retailerDiscounts);
  }, [mealPlans, products, retailerDiscounts]);
  
  const handleDiscountChange = (retailer: string, discountType: DiscountType) => {
    setRetailerDiscounts(prev => ({ ...prev, [retailer]: discountType }));
  };

  const handleToggleCollected = (productId: string) => {
    toggleCollected.mutate(productId);
  };

  const handleResetAll = () => {
    resetAll.mutate(undefined, {
      onSuccess: () => toast.success("Shopping list reset"),
    });
  };
  
  const isLoading = plansLoading || productsLoading;

  // Progress calculation
  const totalItems = shopList.totals.itemCount;
  const collectedCount = shopList.byRetailer.reduce(
    (sum, g) => sum + g.items.filter(i => collectedIds.has(i.product.id)).length,
    0
  );
  const progressPercent = totalItems > 0 ? (collectedCount / totalItems) * 100 : 0;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  const hasItems = shopList.byRetailer.length > 0 || shopList.alreadyCovered.length > 0;
  
  return (
    <div className="space-y-6">
      {/* Week selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Shop List
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium min-w-[150px] sm:min-w-[180px] text-center">
                {format(weekStart, "d MMM")} - {format(weekEnd, "d MMM yyyy")}
              </div>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset(w => w + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              {weekOffset !== 0 && (
                <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
                  Today
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        
        {hasItems && (
          <CardContent className="pt-0 space-y-3">
            {/* Progress bar */}
            {totalItems > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="font-medium">
                      {collectedCount}/{totalItems} items collected
                    </span>
                  </div>
                  {collectedCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={handleResetAll}
                      disabled={resetAll.isPending}
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  )}
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
            )}

            <div className="flex items-center justify-between py-3 border-t">
              <div className="text-sm text-muted-foreground">
                {shopList.totals.itemCount} items across {shopList.byRetailer.length} {shopList.byRetailer.length === 1 ? "retailer" : "retailers"}
              </div>
              <div className="text-right">
                {shopList.totals.totalDiscount > 0 && (
                  <div className="text-sm font-medium text-primary">
                    Saving £{shopList.totals.totalDiscount.toFixed(2)} with loyalty discounts
                  </div>
                )}
                {shopList.totals.deliveryCharges > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Includes £{shopList.totals.deliveryCharges.toFixed(2)} delivery
                  </div>
                )}
                <div className="text-xl font-bold">
                  £{shopList.totals.finalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
      
      {/* Shop list content */}
      {!hasItems ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No items to purchase</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {mealPlans.length === 0
                ? "Plan your meals for this week to generate a grocery list."
                : "All items are covered by your current stock."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Retailer groups */}
          {shopList.byRetailer.map((group) => (
            <RetailerSection
              key={group.retailer}
              group={group}
              onDiscountChange={handleDiscountChange}
              collectedIds={collectedIds}
              onToggleCollected={handleToggleCollected}
            />
          ))}
          
          {/* Easy Saver Gift Card Calculator — show when Iceland items exist */}
          {shopList.byRetailer.some(g => g.retailer === "Iceland") && (
            <EasySaverCalculator
              icelandTotal={shopList.byRetailer.find(g => g.retailer === "Iceland")?.finalTotal ?? 0}
            />
          )}
          
          {/* Already covered items */}
          {shopList.alreadyCovered.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <PackageCheck className="h-5 w-5 text-primary" />
                  Already in Stock
                  <Badge variant="secondary">{shopList.alreadyCovered.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {shopList.alreadyCovered.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/10"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.product.name}</div>
                        <div className="text-sm text-muted-foreground">
                          Need {item.requiredGrams}g • Have {item.stockOnHandGrams}g
                        </div>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary">
                        Covered
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
