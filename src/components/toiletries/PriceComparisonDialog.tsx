import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink, Loader2, RefreshCw, Clock, AlertTriangle, Check } from "lucide-react";
import { useSearchPrices, useToiletryPriceChecks, type PriceCheckResult } from "@/hooks/useToiletryPriceChecks";
import { calculateForecast, formatCurrency, type ToiletryItem } from "@/lib/toiletryCalculations";

interface PriceComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ToiletryItem | null;
}

export function PriceComparisonDialog({
  open,
  onOpenChange,
  item,
}: PriceComparisonDialogProps) {
  const [results, setResults] = useState<PriceCheckResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const { searchPrices, savePriceChecks, isSearching } = useSearchPrices();
  const { savedChecks, lastCheckedAt } = useToiletryPriceChecks(item?.id);

  // Calculate forecast for order-by date
  const forecast = item ? calculateForecast(item) : null;
  const runOutDate = forecast?.runOutDate;

  // Reset state when item changes
  useEffect(() => {
    if (item?.id) {
      setResults([]);
      setHasSearched(false);
    }
  }, [item?.id]);

  // Load saved checks when dialog opens
  useEffect(() => {
    if (open && savedChecks.length > 0 && !hasSearched) {
      setResults(savedChecks.map(c => ({
        retailer: c.retailer,
        price: c.price,
        offer_price: c.offer_price ?? undefined,
        offer_label: c.offer_label ?? undefined,
        product_url: c.product_url || "",
        product_name: c.product_name || item?.name || "",
        dispatch_days: c.dispatch_days ?? undefined,
        delivery_days: c.delivery_days ?? undefined,
        total_lead_time: c.total_lead_time ?? undefined,
        in_stock: c.in_stock,
      })));
    }
  }, [open, savedChecks, hasSearched, item?.name]);

  const handleSearch = async () => {
    if (!item) return;
    
    const searchResults = await searchPrices(item);
    setResults(searchResults);
    setHasSearched(true);
    
    if (searchResults.length > 0) {
      savePriceChecks.mutate({ itemId: item.id, results: searchResults });
    }
  };

  // Calculate order-by date for each result
  const getOrderByDate = (leadTime: number): { date: Date; urgent: boolean; text: string } => {
    if (!runOutDate || !isFinite(forecast?.daysRemaining || 0)) {
      return { date: new Date(), urgent: false, text: "N/A" };
    }
    
    const buffer = 2; // 2-day safety buffer
    const orderByDate = addDays(runOutDate, -(leadTime + buffer));
    const today = new Date();
    const daysUntilOrder = Math.ceil((orderByDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      date: orderByDate,
      urgent: daysUntilOrder <= 3,
      text: daysUntilOrder <= 0 ? "Order now!" : format(orderByDate, "d MMM"),
    };
  };

  const formatLeadTime = (result: PriceCheckResult): string => {
    const total = (result.dispatch_days || 0) + (result.delivery_days || 0);
    if (total === 0) return "Same day";
    if (total === 1) return "1 day";
    return `${total} days`;
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-3xl">
        <ResponsiveDialogHeader className="pr-8">
          <ResponsiveDialogTitle>Find Best Price</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {item?.brand ? `${item.brand} ` : ""}{item?.name}
            {item?.total_size && item?.size_unit && ` (${item.total_size}${item.size_unit})`}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4">
          {/* Forecast info */}
          {forecast && isFinite(forecast.daysRemaining) && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <strong>{forecast.daysRemaining}</strong> days until empty
                </span>
              </div>
              <div className="text-sm text-muted-foreground">
                Run out: {forecast.runOutDateFormatted}
              </div>
            </div>
          )}

          {/* Search button */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {lastCheckedAt && (
                <span>Last checked: {format(new Date(lastCheckedAt), "d MMM 'at' HH:mm")}</span>
              )}
            </div>
            <Button onClick={handleSearch} disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {results.length > 0 ? "Refresh Prices" : "Search Prices"}
                </>
              )}
            </Button>
          </div>

          {/* Results table */}
          {results.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Retailer</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Delivery</TableHead>
                    <TableHead>Order By</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, idx) => {
                    const leadTime = (result.dispatch_days || 0) + (result.delivery_days || 0);
                    const orderBy = getOrderByDate(leadTime);
                    const effectivePrice = result.offer_price || result.price;
                    const isBest = idx === 0;

                    return (
                      <TableRow key={`${result.retailer}-${idx}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{result.retailer}</span>
                            {isBest && (
                              <Badge variant="default" className="text-xs">
                                <Check className="mr-1 h-3 w-3" />
                                Best
                              </Badge>
                            )}
                            {!result.in_stock && (
                              <Badge variant="secondary" className="text-xs">
                                Out of stock
                              </Badge>
                            )}
                          </div>
                          {result.offer_label && (
                            <span className="text-xs text-muted-foreground block">
                              {result.offer_label}
                            </span>
                          )}
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatCurrency(effectivePrice)}
                            </span>
                            {result.offer_price && (
                              <span className="text-xs text-muted-foreground line-through">
                                {formatCurrency(result.price)}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          <span className="text-sm">{formatLeadTime(result)}</span>
                        </TableCell>
                        
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {orderBy.urgent && (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            )}
                            <span className={orderBy.urgent ? "text-amber-600 font-medium" : ""}>
                              {orderBy.text}
                            </span>
                          </div>
                        </TableCell>
                        
                        <TableCell>
                          {result.product_url && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => window.open(result.product_url, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : hasSearched && !isSearching ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No prices found for this product.</p>
              <p className="text-sm">Try adjusting the product name or searching manually.</p>
            </div>
          ) : !isSearching && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Click "Search Prices" to find the best deals.</p>
              <p className="text-sm">We'll search UK retailers and calculate order-by dates.</p>
            </div>
          )}

          {isSearching && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Searching UK retailers...</p>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
