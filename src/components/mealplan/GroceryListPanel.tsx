import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MealPlan } from "@/hooks/useMealPlanItems";
import { generateGroceryList, GroceryItem } from "@/lib/mealCalculations";

interface GroceryListPanelProps {
  plans: MealPlan[];
}

export function GroceryListPanel({ plans }: GroceryListPanelProps) {
  const groceryItems = generateGroceryList(plans);
  const totalCost = groceryItems.reduce((sum, item) => sum + item.totalCost, 0);

  if (groceryItems.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-medium mb-2">No items yet</h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            Add foods to your meal plan to generate a grocery list.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Grocery List
            </div>
            <div className="text-lg font-bold text-primary">
              £{totalCost.toFixed(2)} total
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Required</TableHead>
                <TableHead className="text-right">Purchase</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groceryItems.map((item) => (
                <TableRow key={item.product.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.product.name}</span>
                      {item.product.ignore_macros && (
                        <Badge variant="outline" className="text-xs">No macros</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {Math.round(item.requiredGrams)}g
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-medium">{item.purchaseQuantity}</span>
                    <span className="text-muted-foreground text-sm ml-1">
                      {item.purchaseUnits}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    £{item.totalCost.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>• Required grams are calculated from your meal plan</p>
            <p>• Purchase quantities are rounded up to nearest pack size</p>
            <p>• Nutrition calculations use required grams, not rounded amounts</p>
            <p>• Items from skipped meals are excluded</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
