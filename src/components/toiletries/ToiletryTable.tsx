import { useState, useMemo } from "react";
import { ToiletryImage } from "./ToiletryImage";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Scale, Link, Search, ArrowUp, ArrowDown, ArrowUpDown, Package } from "lucide-react";
import {
  calculateForecast,
  formatCurrency,
  getStatusBadgeVariant,
  getStatusDisplayText,
  TOILETRY_CATEGORIES,
  type ToiletryItem,
  type ToiletryForecast,
} from "@/lib/toiletryCalculations";
import {
  getReorderBadgeVariant,
  getReorderStatusLabel,
  type ShippingProfile,
} from "@/lib/reorderCalculations";
import { useIsMobile } from "@/hooks/use-mobile";
import { ToiletryCard } from "./ToiletryCard";
import { cn } from "@/lib/utils";

type SortKey = "name" | "category" | "remaining" | "dailyUsage" | "daysLeft" | "orderBy" | "monthly";
type SortDir = "asc" | "desc";

interface ToiletryTableProps {
  items: ToiletryItem[];
  onEdit: (item: ToiletryItem) => void;
  onDelete: (item: ToiletryItem) => void;
  onRestock: (item: ToiletryItem) => void;
  onLogWeight?: (item: ToiletryItem) => void;
  onLinkPurchase?: (item: ToiletryItem) => void;
  onFindPrices?: (item: ToiletryItem) => void;
  usageRates?: Record<string, number | null>;
  shippingProfiles?: Record<string, ShippingProfile | null>;
}

function SortIcon({ sortKey, currentKey, dir }: { sortKey: SortKey; currentKey: SortKey | null; dir: SortDir }) {
  if (currentKey !== sortKey) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
  return dir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
}

export function ToiletryTable({
  items,
  onEdit,
  onDelete,
  onRestock,
  onLogWeight,
  onLinkPurchase,
  onFindPrices,
  usageRates,
  shippingProfiles,
}: ToiletryTableProps) {
  const isMobile = useIsMobile();
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No toiletry items yet.</p>
        <p className="text-sm">Add your first item to start tracking.</p>
      </div>
    );
  }

  const getForecast = (item: ToiletryItem): ToiletryForecast => {
    return calculateForecast(item, {
      logBasedUsageRate: usageRates?.[item.id] ?? null,
      shippingProfile: item.retailer
        ? shippingProfiles?.[item.retailer.toLowerCase()] ?? null
        : null,
    });
  };

  const forecastMap = new Map<string, ToiletryForecast>();
  items.forEach(item => forecastMap.set(item.id, getForecast(item)));

  const sortedItems = [...items].sort((a, b) => {
    if (!sortKey) return 0;
    const fa = forecastMap.get(a.id)!;
    const fb = forecastMap.get(b.id)!;
    let cmp = 0;
    switch (sortKey) {
      case "name": cmp = a.name.localeCompare(b.name); break;
      case "category": cmp = a.category.localeCompare(b.category); break;
      case "remaining": cmp = fa.percentRemaining - fb.percentRemaining; break;
      case "dailyUsage": cmp = fa.effectiveDailyUsage - fb.effectiveDailyUsage; break;
      case "daysLeft": {
        const da = fa.daysRemaining === Infinity ? 999999 : fa.daysRemaining;
        const db = fb.daysRemaining === Infinity ? 999999 : fb.daysRemaining;
        cmp = da - db; break;
      }
      case "orderBy": {
        const oa = fa.orderByDate?.getTime() ?? Infinity;
        const ob = fb.orderByDate?.getTime() ?? Infinity;
        cmp = oa - ob; break;
      }
      case "monthly": cmp = fa.monthlyCost - fb.monthlyCost; break;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {sortedItems.map((item) => (
          <ToiletryCard
            key={item.id}
            item={item}
            forecast={forecastMap.get(item.id)!}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestock={onRestock}
          />
        ))}
      </div>
    );
  }

  const headerClass = "cursor-pointer select-none hover:text-foreground transition-colors";

  // Desktop: Table layout
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={headerClass} onClick={() => toggleSort("name")}>
              <span className="inline-flex items-center">Item <SortIcon sortKey="name" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={cn("hidden sm:table-cell", headerClass)} onClick={() => toggleSort("category")}>
              <span className="inline-flex items-center">Category <SortIcon sortKey="category" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={headerClass} onClick={() => toggleSort("remaining")}>
              <span className="inline-flex items-center">Remaining <SortIcon sortKey="remaining" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={cn("hidden md:table-cell", headerClass)} onClick={() => toggleSort("dailyUsage")}>
              <span className="inline-flex items-center">Daily Usage <SortIcon sortKey="dailyUsage" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={cn("hidden md:table-cell", headerClass)} onClick={() => toggleSort("daysLeft")}>
              <span className="inline-flex items-center">Days Left <SortIcon sortKey="daysLeft" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={cn("hidden lg:table-cell", headerClass)} onClick={() => toggleSort("orderBy")}>
              <span className="inline-flex items-center">Order By <SortIcon sortKey="orderBy" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className={cn("hidden lg:table-cell", headerClass)} onClick={() => toggleSort("monthly")}>
              <span className="inline-flex items-center">Monthly <SortIcon sortKey="monthly" currentKey={sortKey} dir={sortDir} /></span>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const forecast = forecastMap.get(item.id)!;
            const categoryLabel = TOILETRY_CATEGORIES.find(
              (c) => c.value === item.category
            )?.label || item.category;
            
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg overflow-hidden border border-border shrink-0 bg-muted flex items-center justify-center">
                      {item.image_url ? (
                        <ToiletryImage imageUrl={item.image_url} alt={item.name} />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {item.total_size}{item.size_unit} • {formatCurrency(item.cost_per_item)}
                        </span>
                        <Badge variant={getStatusBadgeVariant(item, forecast)} className="text-xs">
                          {getStatusDisplayText(item, forecast)}
                        </Badge>
                        {item.retailer && (
                          <Badge variant="outline" className="text-xs">
                            {item.retailer}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">{categoryLabel}</Badge>
                </TableCell>
                
                <TableCell>
                  <div className="flex flex-col gap-1.5 min-w-[100px]">
                    <div className="flex items-center justify-between text-sm">
                      <span>{item.current_remaining}{item.size_unit}</span>
                      <span className="text-muted-foreground">{forecast.percentRemaining}%</span>
                    </div>
                    <Progress 
                      value={forecast.percentRemaining} 
                      className="h-2"
                    />
                  </div>
                </TableCell>

                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {forecast.effectiveDailyUsage.toFixed(1)}{item.size_unit}/day
                    </span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {forecast.usageSource === "log" ? "📊 Logged" : 
                       forecast.usageSource === "weight" ? "⚖️ Weight" : "✏️ Manual"}
                    </span>
                  </div>
                </TableCell>
                
                <TableCell className="hidden md:table-cell">
                  <span className={cn(
                    forecast.statusLevel === "low" && "text-warning font-medium",
                    forecast.statusLevel === "empty" && "text-destructive font-medium"
                  )}>
                    {forecast.daysRemaining === Infinity ? "—" : `${forecast.daysRemaining} days`}
                  </span>
                </TableCell>

                <TableCell className="hidden lg:table-cell">
                  {forecast.orderByFormatted ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold">
                        {forecast.orderByFormatted}
                      </span>
                      <Badge 
                        variant={getReorderBadgeVariant(forecast.reorderStatus)} 
                        className="text-xs w-fit"
                      >
                        {getReorderStatusLabel(forecast.reorderStatus)}
                      </Badge>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {item.retailer ? "—" : "Set retailer"}
                    </span>
                  )}
                </TableCell>
                
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm font-medium">
                    {formatCurrency(forecast.monthlyCost)}
                  </span>
                </TableCell>
                
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover">
                        <DropdownMenuItem onClick={() => onEdit(item)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        {onLogWeight && (
                          <DropdownMenuItem onClick={() => onLogWeight(item)}>
                            <Scale className="mr-2 h-4 w-4" />
                            Log Weight
                          </DropdownMenuItem>
                        )}
                        {onLinkPurchase && (
                          <DropdownMenuItem onClick={() => onLinkPurchase(item)}>
                            <Link className="mr-2 h-4 w-4" />
                            Link Purchase
                          </DropdownMenuItem>
                        )}
                        {onFindPrices && (
                          <DropdownMenuItem onClick={() => onFindPrices(item)}>
                            <Search className="mr-2 h-4 w-4" />
                            Find Best Price
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onRestock(item)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Restock
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onDelete(item)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}