import { useState, useMemo } from "react";
import { Scale, Check, Package } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface WeighStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

export function WeighStockDialog({ open, onOpenChange, products }: WeighStockDialogProps) {
  const queryClient = useQueryClient();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [unitCounts, setUnitCounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Fixed/pre-packaged products: enter as unit counts
  const fixedProducts = useMemo(
    () => products.filter((p) => p.product_type === "fixed" && (p.fixed_portion_grams ?? 0) > 0),
    [products]
  );

  // Weighable products: enter scale reading (existing behaviour)
  const weighableProducts = useMemo(
    () => products.filter((p) => (p.packaging_weight_grams ?? 0) > 0 && p.product_type !== "fixed"),
    [products]
  );

  const handleWeightChange = (productId: string, value: string) => {
    setWeights((prev) => ({ ...prev, [productId]: value }));
  };

  const handleUnitChange = (productId: string, value: string) => {
    setUnitCounts((prev) => ({ ...prev, [productId]: value }));
  };

  const getUsableGrams = (product: Product, scaleWeight: number) => {
    const packaging = product.packaging_weight_grams ?? 0;
    return Math.max(0, scaleWeight - packaging);
  };

  /** For fixed products, figure out a readable unit label */
  const getUnitLabel = (product: Product): string => {
    const portion = product.fixed_portion_grams ?? 0;
    const pack = product.pack_size_grams ?? 0;
    // If portion == pack, it's a single-serve tub/bag
    if (portion > 0 && pack > 0 && portion === pack) return "tub";
    // Otherwise it's individual units within a pack
    if (portion <= 20) return "cake";
    if (portion <= 60) return "packet";
    return "bag";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updateCount = 0;

      // Save weight-based items (existing logic)
      const weightUpdates = Object.entries(weights)
        .filter(([, val]) => val !== "" && !isNaN(Number(val)))
        .map(([id, val]) => ({ id, weight: Number(val) }));

      for (const { id, weight } of weightUpdates) {
        const { error } = await supabase
          .from("products")
          .update({ current_weight_grams: weight })
          .eq("id", id);
        if (error) throw error;
        updateCount++;
      }

      // Save unit-count items → quantity_on_hand, clear current_weight_grams so pack-based calc is used
      const unitUpdates = Object.entries(unitCounts)
        .filter(([, val]) => val !== "" && !isNaN(Number(val)))
        .map(([id, val]) => ({ id, units: Number(val) }));

      for (const { id, units } of unitUpdates) {
        const product = products.find((p) => p.id === id);
        const portionG = product?.fixed_portion_grams ?? 0;
        const packG = product?.pack_size_grams ?? portionG;

        // Convert units to packs: if portion == pack it's 1:1, otherwise calculate
        let packsOnHand: number;
        if (portionG > 0 && packG > 0 && portionG < packG) {
          // Multiple units per pack — store fractional packs
          const unitsPerPack = packG / portionG;
          packsOnHand = units / unitsPerPack;
        } else {
          // 1 unit = 1 pack
          packsOnHand = units;
        }

        const { error } = await supabase
          .from("products")
          .update({
            quantity_on_hand: packsOnHand,
            current_weight_grams: null, // ensure pack-based calc is used
          })
          .eq("id", id);
        if (error) throw error;
        updateCount++;
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Updated ${updateCount} item${updateCount !== 1 ? "s" : ""}`);
      setWeights({});
      setUnitCounts({});
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const changedCount =
    Object.values(weights).filter((v) => v !== "" && !isNaN(Number(v))).length +
    Object.values(unitCounts).filter((v) => v !== "" && !isNaN(Number(v))).length;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Weigh What I Have
          </ResponsiveDialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter stock levels for your products. Pre-packaged items use unit counts; other items use scale weight.
          </p>
        </ResponsiveDialogHeader>

        <div className="space-y-5 py-2">
          {/* ── Pre-packaged / Fixed products ── */}
          {fixedProducts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                Pre-packaged Items
              </h3>
              {fixedProducts.map((product) => {
                const inputVal = unitCounts[product.id] ?? "";
                const units = inputVal ? Number(inputVal) : null;
                const portionG = product.fixed_portion_grams ?? 0;
                const totalGrams = units != null && !isNaN(units) ? units * portionG : null;
                const unitLabel = getUnitLabel(product);

                // Calculate current stock in units
                const currentUnits = (() => {
                  if (product.current_weight_grams != null && product.current_weight_grams > 0 && portionG > 0) {
                    const packaging = product.packaging_weight_grams ?? 0;
                    return Math.floor(Math.max(0, product.current_weight_grams - packaging) / portionG);
                  }
                  const onHand = product.quantity_on_hand ?? 0;
                  const packG = product.pack_size_grams ?? portionG;
                  if (portionG > 0 && packG > 0 && portionG < packG) {
                    return Math.round(onHand * (packG / portionG));
                  }
                  return onHand;
                })();

                return (
                  <div
                    key={product.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm leading-tight">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {portionG}g per {unitLabel}
                        {currentUnits > 0 && (
                          <> • Currently: {currentUnits} {unitLabel}{currentUnits !== 1 ? "s" : ""}</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-20">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          placeholder="Qty"
                          value={inputVal}
                          onChange={(e) => handleUnitChange(product.id, e.target.value)}
                          className="text-sm h-9"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {unitLabel}s
                      </span>
                      {totalGrams != null && (
                        <Badge
                          variant="default"
                          className="min-w-[50px] justify-center text-xs"
                        >
                          {Math.round(totalGrams)}g
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Weight-based products ── */}
          {weighableProducts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                <Scale className="h-4 w-4" />
                Weigh on Scales
              </h3>
              {weighableProducts.map((product) => {
                const inputVal = weights[product.id] ?? "";
                const scaleWeight = inputVal ? Number(inputVal) : null;
                const usable =
                  scaleWeight != null && !isNaN(scaleWeight)
                    ? getUsableGrams(product, scaleWeight)
                    : null;

                return (
                  <div
                    key={product.id}
                    className="rounded-lg border p-3 space-y-2"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm leading-tight">{product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Packaging: {product.packaging_weight_grams}g
                        {product.current_weight_grams != null && (
                          <> • Last: {product.current_weight_grams}g</>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-24">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="numeric"
                          placeholder="Weight"
                          value={inputVal}
                          onChange={(e) => handleWeightChange(product.id, e.target.value)}
                          className="pr-6 text-sm h-9"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          g
                        </span>
                      </div>
                      {usable != null && (
                        <Badge
                          variant={usable > 0 ? "default" : "secondary"}
                          className="min-w-[50px] justify-center text-xs"
                        >
                          {usable}g left
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {fixedProducts.length === 0 && weighableProducts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No products with stock tracking enabled. Update products to add packaging weights or set them as fixed portions.
            </p>
          )}
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || changedCount === 0}>
            <Check className="mr-2 h-4 w-4" />
            Save {changedCount > 0 ? `(${changedCount})` : ""}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
