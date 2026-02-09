import { useState, useMemo } from "react";
import { Scale, Check } from "lucide-react";
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
import { Product, useProducts } from "@/hooks/useProducts";
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
  const [saving, setSaving] = useState(false);

  // Only show products that have a packaging weight set
  const weighableProducts = useMemo(
    () => products.filter((p) => (p.packaging_weight_grams ?? 0) > 0),
    [products]
  );

  const handleWeightChange = (productId: string, value: string) => {
    setWeights((prev) => ({ ...prev, [productId]: value }));
  };

  const getUsableGrams = (product: Product, scaleWeight: number) => {
    const packaging = product.packaging_weight_grams ?? 0;
    return Math.max(0, scaleWeight - packaging);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(weights)
        .filter(([, val]) => val !== "" && !isNaN(Number(val)))
        .map(([id, val]) => ({ id, weight: Number(val) }));

      for (const { id, weight } of updates) {
        const { error } = await supabase
          .from("products")
          .update({ current_weight_grams: weight })
          .eq("id", id);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(`Updated ${updates.length} item weights`);
      setWeights({});
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Failed to save weights: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const changedCount = Object.values(weights).filter(
    (v) => v !== "" && !isNaN(Number(v))
  ).length;

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Weigh What I Have
          </ResponsiveDialogTitle>
          <p className="text-sm text-muted-foreground">
            Enter the scale reading (including packaging) for each item. The system subtracts the empty packaging weight to calculate usable stock.
          </p>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-2">
          {weighableProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No products have packaging weights set yet. Update products to add empty packaging weights.
            </p>
          ) : (
            weighableProducts.map((product) => {
              const inputVal = weights[product.id] ?? "";
              const scaleWeight = inputVal ? Number(inputVal) : null;
              const usable =
                scaleWeight != null && !isNaN(scaleWeight)
                  ? getUsableGrams(product, scaleWeight)
                  : null;

              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate text-sm">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Packaging: {product.packaging_weight_grams}g
                      {product.current_weight_grams != null && (
                        <> • Last: {product.current_weight_grams}g</>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative w-24">
                      <Input
                        type="number"
                        min="0"
                        step="1"
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
                        className="min-w-[60px] justify-center text-xs"
                      >
                        {usable}g left
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })
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
