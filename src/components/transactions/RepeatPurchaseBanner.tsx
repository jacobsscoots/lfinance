import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Plus, Package, X, ChevronDown, ChevronUp } from "lucide-react";
import { useRepeatPurchases, RepeatPurchase } from "@/hooks/useRepeatPurchases";
import { useBills } from "@/hooks/useBills";
import { useToiletries } from "@/hooks/useToiletries";
import { format, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function intervalLabel(days: number): string {
  if (days <= 10) return "weekly";
  if (days <= 21) return "fortnightly";
  if (days <= 45) return "monthly";
  if (days <= 75) return "bi-monthly";
  if (days <= 100) return "quarterly";
  return `every ~${days} days`;
}

function frequencyForBill(days: number): "weekly" | "fortnightly" | "monthly" | "bimonthly" | "quarterly" {
  if (days <= 10) return "weekly";
  if (days <= 21) return "fortnightly";
  if (days <= 45) return "monthly";
  if (days <= 75) return "bimonthly";
  return "quarterly";
}

export function RepeatPurchaseBanner() {
  const { data: repeats = [], isLoading } = useRepeatPurchases();
  const { createBill } = useBills();
  const { createToiletry } = useToiletries();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  // Only show unlinked, undismissed suggestions
  const suggestions = repeats.filter(
    (r) => !r.isLinkedToBill && !r.isLinkedToToiletry && !dismissed.has(r.merchant)
  );

  if (isLoading || suggestions.length === 0) return null;

  const visible = expanded ? suggestions : suggestions.slice(0, 3);

  const handleAddAsBill = (repeat: RepeatPurchase) => {
    const freq = frequencyForBill(repeat.averageIntervalDays);
    const nextDate = new Date(repeat.predictedNextDate);
    const dueDay = nextDate.getDate();

    createBill.mutate(
      {
        name: repeat.merchant,
        amount: repeat.averageAmount,
        frequency: freq,
        due_day: dueDay,
        due_date_rule: "exact",
        is_subscription: true,
        is_active: true,
      },
      {
        onSuccess: () => {
          toast.success(`Added "${repeat.merchant}" as a ${intervalLabel(repeat.averageIntervalDays)} subscription`);
          setDismissed((prev) => new Set(prev).add(repeat.merchant));
        },
      }
    );
  };

  const handleAddAsToiletry = (repeat: RepeatPurchase) => {
    // Calculate usage rate from interval: 1 unit consumed per interval
    const usagePerDay = 1 / repeat.averageIntervalDays;

    createToiletry.mutate(
      {
        name: repeat.merchant,
        brand: repeat.merchant,
        category: "supplements",
        section: "toiletry",
        total_size: 1,
        size_unit: "pack",
        cost_per_item: repeat.averageAmount,
        offer_price: null,
        offer_label: null,
        usage_rate_per_day: usagePerDay,
        current_remaining: 1,
        pack_size: 1,
        safety_buffer_days: 7,
        status: "active",
        retailer: repeat.merchant,
        notes: `Auto-detected from ${repeat.occurrences.length} repeat purchases (~${intervalLabel(repeat.averageIntervalDays)})`,
        image_url: null,
        source_url: null,
        last_restocked_at: repeat.occurrences[repeat.occurrences.length - 1]?.date || null,
        quantity_on_hand: 1,
        quantity_in_use: 1,
        reorder_threshold: 1,
        target_quantity: 1,
        gross_size: null,
        packaging_weight: null,
        opened_at: repeat.occurrences[repeat.occurrences.length - 1]?.date || null,
        finished_at: null,
        empty_weight_grams: null,
        full_weight_grams: null,
        current_weight_grams: null,
        calculated_usage_rate: null,
        last_weighed_at: null,
      },
      {
        onSuccess: () => {
          toast.success(`Added "${repeat.merchant}" to Toiletries for reorder tracking`);
          setDismissed((prev) => new Set(prev).add(repeat.merchant));
        },
      }
    );
  };

  const handleDismiss = (merchant: string) => {
    setDismissed((prev) => new Set(prev).add(merchant));
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Repeat Purchases Detected</span>
            <Badge variant="secondary" className="text-xs">{suggestions.length}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          {visible.map((repeat) => {
            const daysUntil = differenceInDays(new Date(repeat.predictedNextDate), new Date());
            const isPast = daysUntil < 0;

            return (
              <div
                key={repeat.merchant}
                className="flex items-center justify-between gap-3 rounded-lg border bg-background p-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{repeat.merchant}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {intervalLabel(repeat.averageIntervalDays)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ~£{repeat.averageAmount.toFixed(2)} · {repeat.occurrences.length} purchases ·{" "}
                    {isPast ? (
                      <span className="text-destructive">was due {format(new Date(repeat.predictedNextDate), "d MMM")}</span>
                    ) : (
                      <span>next ~{format(new Date(repeat.predictedNextDate), "d MMM")}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleAddAsBill(repeat)}
                    disabled={createBill.isPending}
                  >
                    <Plus className="h-3 w-3" />
                    Add as bill
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleAddAsToiletry(repeat)}
                    disabled={createToiletry.isPending}
                  >
                    <Package className="h-3 w-3" />
                    Track reorder
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => handleDismiss(repeat.merchant)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {suggestions.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3 mr-1" /> Show less</>
            ) : (
              <><ChevronDown className="h-3 w-3 mr-1" /> Show {suggestions.length - 3} more</>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
