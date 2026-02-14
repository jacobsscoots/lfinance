import { MoreVertical, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { ToiletryImage } from "./ToiletryImage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
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
} from "@/lib/reorderCalculations";
import { cn } from "@/lib/utils";

interface ToiletryCardProps {
  item: ToiletryItem;
  forecast: ToiletryForecast;
  onEdit: (item: ToiletryItem) => void;
  onDelete: (item: ToiletryItem) => void;
  onRestock: (item: ToiletryItem) => void;
}

export function ToiletryCard({ item, forecast, onEdit, onDelete, onRestock }: ToiletryCardProps) {
  const categoryLabel = TOILETRY_CATEGORIES.find(c => c.value === item.category)?.label || item.category;

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          {/* Thumbnail */}
          {item.image_url && (
            <div className="h-12 w-12 rounded-lg overflow-hidden border border-border shrink-0">
              <ToiletryImage imageUrl={item.image_url} alt={item.name} />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-sm truncate">{item.name}</h3>
              <Badge variant={getStatusBadgeVariant(item, forecast)} className="text-xs shrink-0">
                {getStatusDisplayText(item, forecast)}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {categoryLabel}
              </Badge>
              {item.retailer && (
                <Badge variant="outline" className="text-xs">
                  {item.retailer}
                </Badge>
              )}
              <span>•</span>
              <span>{item.total_size}{item.size_unit}</span>
              <span>•</span>
              <span>{formatCurrency(item.cost_per_item)}</span>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuItem onClick={() => onRestock(item)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Restock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onDelete(item)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Progress 
              value={forecast.percentRemaining} 
              className={cn(
                "h-2 flex-1",
                forecast.statusLevel === "low" && "[&>div]:bg-warning",
                forecast.statusLevel === "empty" && "[&>div]:bg-destructive"
              )}
            />
            <span className="text-xs text-muted-foreground w-10 text-right">
              {forecast.percentRemaining}%
            </span>
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {item.current_remaining.toFixed(0)}{item.size_unit} remaining
            </span>
            {forecast.daysRemaining !== Infinity && (
              <span className={cn(
                "font-medium",
                forecast.statusLevel === "low" && "text-warning",
                forecast.statusLevel === "empty" && "text-destructive"
              )}>
                {forecast.daysRemaining} days • {forecast.runOutDateFormatted}
              </span>
            )}
          </div>

          {/* Usage + Order-by row */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
            <span className="text-muted-foreground">
              {forecast.effectiveDailyUsage.toFixed(1)}{item.size_unit}/day
              <span className="ml-1 opacity-70">
                ({forecast.usageSource === "log" ? "logged" : 
                  forecast.usageSource === "weight" ? "weight" : "manual"})
              </span>
            </span>
            {forecast.orderByFormatted && (
              <Badge 
                variant={getReorderBadgeVariant(forecast.reorderStatus)} 
                className="text-xs"
              >
                Order by {forecast.orderByFormatted}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
