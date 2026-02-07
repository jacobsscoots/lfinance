import { useState } from "react";
import { ChevronDown, ChevronUp, Package } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RetailerGroup, ShopReadyItem } from "@/lib/groceryListCalculations";
import { DiscountType } from "@/lib/discounts";

interface RetailerSectionProps {
  group: RetailerGroup;
  onDiscountChange: (retailer: string, discountType: DiscountType) => void;
}

export function RetailerSection({ group, onDiscountChange }: RetailerSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
        <div className="flex items-center gap-3">
          <Package className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">{group.retailer}</span>
          <Badge variant="secondary">{group.items.length} items</Badge>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {group.discountAmount > 0 && (
                <span className="text-primary">-£{group.discountAmount.toFixed(2)} </span>
              )}
              <span className={group.discountAmount > 0 ? "line-through" : ""}>
                £{group.subtotal.toFixed(2)}
              </span>
            </div>
            <div className="font-semibold">£{group.finalTotal.toFixed(2)}</div>
          </div>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="border-t p-4 space-y-4">
          {/* Discount selector */}
          <div className="flex items-center justify-between pb-3 border-b">
            <span className="text-sm text-muted-foreground">Apply discount:</span>
            <Select
              value={group.discountType}
              onValueChange={(value) => onDiscountChange(group.retailer, value as DiscountType)}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No discount</SelectItem>
                <SelectItem value="tesco_benefits">Tesco Benefits (4%)</SelectItem>
                <SelectItem value="easysaver">EasySaver (7%)</SelectItem>
                <SelectItem value="clubcard">Clubcard (pre-reduced)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Items list */}
          <div className="space-y-2">
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
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{item.product.name}</div>
        <div className="text-sm text-muted-foreground">
          {item.requiredGrams}g needed
          {item.stockOnHandGrams > 0 && (
            <span className="text-primary"> (have {item.stockOnHandGrams}g)</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-sm text-center min-w-[80px]">
          <span className="font-medium">{item.purchasePacks}</span>
          <span className="text-muted-foreground"> × {item.packNetGrams}g</span>
        </div>
        <div className="text-right min-w-[60px] font-medium">
          £{item.grossCost.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
