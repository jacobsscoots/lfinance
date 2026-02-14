import { useState } from "react";
import { ChevronDown, ChevronUp, Store, Tag, Percent } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { RetailerGroup, ShopReadyItem } from "@/lib/groceryListCalculations";
import { DiscountType, getRetailerDiscountOptions, getDefaultRetailerDiscount } from "@/lib/discounts";

interface RetailerSectionProps {
  group: RetailerGroup;
  onDiscountChange: (retailer: string, discountType: DiscountType) => void;
}

const RETAILER_COLORS: Record<string, string> = {
  Tesco: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  Iceland: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  MyProtein: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  Aldi: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800",
  Lidl: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  "Sainsbury's": "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  ASDA: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800",
  Morrisons: "bg-yellow-600/10 text-yellow-800 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800",
  Unassigned: "bg-muted text-muted-foreground border-border",
};

const DISCOUNT_LABELS: Record<string, string> = {
  tesco_benefits: "Benefits on Tap (4%)",
  easysaver: "EasySaver Card (7%)",
  rewardgateway: "RewardGateway (10%)",
  clubcard: "Clubcard Prices",
  none: "",
  other: "",
};

export function RetailerSection({ group, onDiscountChange }: RetailerSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const colorClass = RETAILER_COLORS[group.retailer] ?? "bg-primary/10 text-primary border-primary/20";
  const discountLabel = DISCOUNT_LABELS[group.discountType] ?? "";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="rounded-xl border shadow-sm overflow-hidden">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/30 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border ${colorClass}`}>
            <Store className="h-4 w-4" />
          </div>
          <div className="text-left">
            <span className="font-semibold">{group.retailer}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge variant="secondary" className="text-xs">
                {group.items.length} {group.items.length === 1 ? "item" : "items"}
              </Badge>
              {discountLabel && (
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  <Percent className="h-3 w-3 mr-1" />
                  {discountLabel}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            {group.discountAmount > 0 && (
              <div className="text-xs text-primary font-medium">
                -£{group.discountAmount.toFixed(2)} saved
              </div>
            )}
            <div className="text-lg font-bold">£{group.finalTotal.toFixed(2)}</div>
          </div>
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border-t">
          {/* Items list */}
          <div className="p-3 space-y-1.5">
            {group.items.map((item) => (
              <RetailerItemRow key={item.product.id} item={item} />
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RetailerItemRow({ item }: { item: ShopReadyItem }) {
  const hasOfferPrice = item.product.offer_price && item.product.offer_price > 0 && item.product.offer_price < item.product.price;
  
  return (
    <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.product.name}</span>
          {hasOfferPrice && (
            <Badge variant="outline" className="text-xs text-primary border-primary/30 shrink-0">
              {item.product.offer_label || "Offer"}
            </Badge>
          )}
          {item.multiBuyOffer && (
            <Badge variant="outline" className="text-xs shrink-0" style={{ color: "hsl(var(--chart-4))", borderColor: "hsl(var(--chart-4) / 0.3)" }}>
              {item.multiBuyOffer.offerLabel}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {item.netNeededGrams}g needed
          {item.stockOnHandGrams > 0 && (
            <span className="text-primary"> · {item.stockOnHandGrams}g in stock</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-xs text-center min-w-[70px] text-muted-foreground">
          <span className="font-medium text-foreground">{item.purchasePacks}</span>
          <span> × {item.packNetGrams}g</span>
        </div>
        <div className="text-right min-w-[60px]">
          {item.multiBuyDiscount > 0 && (
            <div className="text-xs text-primary line-through">
              £{(item.grossCost).toFixed(2)}
            </div>
          )}
          <div className="font-semibold">
            £{item.costAfterMultiBuy.toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
}
