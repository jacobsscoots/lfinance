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
import { MoreHorizontal, Pencil, Trash2, RefreshCw, Scale, Link, Search } from "lucide-react";
import {
  calculateForecast,
  formatCurrency,
  getStatusBadgeVariant,
  getStatusDisplayText,
  TOILETRY_CATEGORIES,
  type ToiletryItem,
} from "@/lib/toiletryCalculations";
import { useIsMobile } from "@/hooks/use-mobile";
import { ToiletryCard } from "./ToiletryCard";

interface ToiletryTableProps {
  items: ToiletryItem[];
  onEdit: (item: ToiletryItem) => void;
  onDelete: (item: ToiletryItem) => void;
  onRestock: (item: ToiletryItem) => void;
  onLogWeight?: (item: ToiletryItem) => void;
  onLinkPurchase?: (item: ToiletryItem) => void;
  onFindPrices?: (item: ToiletryItem) => void;
}

export function ToiletryTable({
  items,
  onEdit,
  onDelete,
  onRestock,
  onLogWeight,
  onLinkPurchase,
  onFindPrices,
}: ToiletryTableProps) {
  const isMobile = useIsMobile();

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No toiletry items yet.</p>
        <p className="text-sm">Add your first item to start tracking.</p>
      </div>
    );
  }

  // Mobile: Card layout
  if (isMobile) {
    return (
      <div className="space-y-3">
        {items.map((item) => (
          <ToiletryCard
            key={item.id}
            item={item}
            onEdit={onEdit}
            onDelete={onDelete}
            onRestock={onRestock}
          />
        ))}
      </div>
    );
  }

  // Desktop: Table layout with horizontal scroll
  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="hidden sm:table-cell">Category</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead className="hidden md:table-cell">Days Left</TableHead>
            <TableHead className="hidden md:table-cell">Run-out</TableHead>
            <TableHead className="hidden lg:table-cell">Monthly</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const forecast = calculateForecast(item);
            const categoryLabel = TOILETRY_CATEGORIES.find(
              (c) => c.value === item.category
            )?.label || item.category;
            
            return (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.total_size}{item.size_unit} • {formatCurrency(item.cost_per_item)}
                      </span>
                      <Badge variant={getStatusBadgeVariant(item, forecast)} className="text-xs">
                        {getStatusDisplayText(item, forecast)}
                      </Badge>
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
                  <span className={forecast.statusLevel === "low" ? "text-amber-600 font-medium" : 
                                  forecast.statusLevel === "empty" ? "text-destructive font-medium" : ""}>
                    {forecast.daysRemaining === Infinity ? "—" : `${forecast.daysRemaining} days`}
                  </span>
                </TableCell>
                
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm">
                    {forecast.runOutDateFormatted}
                  </span>
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
