import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Search, Receipt, Link } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTransactions } from "@/hooks/useTransactions";
import { calculateLoyaltyDiscount, type DiscountType } from "@/lib/toiletryUsageCalculations";
import { formatCurrency, type ToiletryItem } from "@/lib/toiletryCalculations";

const purchaseFormSchema = z.object({
  transaction_id: z.string().nullable(),
  purchase_date: z.string().min(1, "Date is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unit_price: z.coerce.number().min(0, "Price cannot be negative"),
  discount_type: z.enum(["none", "tesco_benefits", "easysaver", "clubcard", "other"]),
  notes: z.string().optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseFormSchema>;

interface LinkPurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ToiletryItem | null;
  onSubmit: (values: {
    toiletry_item_id: string;
    transaction_id: string | null;
    purchase_date: string;
    quantity: number;
    unit_price: number;
    discount_type: string;
    discount_amount: number;
    final_price: number;
    notes: string | null;
  }) => void;
  isLoading?: boolean;
}

export function LinkPurchaseDialog({
  open,
  onOpenChange,
  item,
  onSubmit,
  isLoading = false,
}: LinkPurchaseDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "manual">("search");
  const { transactions } = useTransactions();

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      transaction_id: null,
      purchase_date: format(new Date(), "yyyy-MM-dd"),
      quantity: 1,
      unit_price: item?.cost_per_item ?? 0,
      discount_type: "none",
      notes: "",
    },
  });

  // Filter expense transactions that might be related
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];

    return transactions
      .filter((t) => t.type === "expense")
      .filter((t) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          t.description?.toLowerCase().includes(query) ||
          t.merchant?.toLowerCase().includes(query)
        );
      })
      .slice(0, 20);
  }, [transactions, searchQuery]);

  const watchedUnitPrice = form.watch("unit_price");
  const watchedQuantity = form.watch("quantity");
  const watchedDiscountType = form.watch("discount_type") as DiscountType;

  // Calculate discount in real-time
  const discountCalc = useMemo(() => {
    const totalPrice = watchedUnitPrice * watchedQuantity;
    return calculateLoyaltyDiscount(totalPrice, watchedDiscountType);
  }, [watchedUnitPrice, watchedQuantity, watchedDiscountType]);

  const handleSelectTransaction = (transaction: typeof filteredTransactions[0]) => {
    form.setValue("transaction_id", transaction.id);
    form.setValue("purchase_date", transaction.transaction_date);
    form.setValue("unit_price", Math.abs(transaction.amount));
    setActiveTab("manual");
  };

  const handleSubmit = (values: PurchaseFormValues) => {
    if (!item) return;

    const totalPrice = values.unit_price * values.quantity;
    const discount = calculateLoyaltyDiscount(totalPrice, values.discount_type as DiscountType);

    onSubmit({
      toiletry_item_id: item.id,
      transaction_id: values.transaction_id,
      purchase_date: values.purchase_date,
      quantity: values.quantity,
      unit_price: values.unit_price,
      discount_type: values.discount_type,
      discount_amount: discount.discountAmount,
      final_price: discount.finalPrice,
      notes: values.notes || null,
    });

    onOpenChange(false);
    form.reset();
    setSearchQuery("");
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Link Purchase - {item?.name}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "search" | "manual")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="search">Link Transaction</TabsTrigger>
                <TabsTrigger value="manual">Enter Manually</TabsTrigger>
              </TabsList>

              <TabsContent value="search" className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-[200px] rounded-md border">
                  {filteredTransactions.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No matching transactions found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {filteredTransactions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleSelectTransaction(t)}
                          className="w-full text-left p-3 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <p className="font-medium text-sm">
                                {t.merchant || t.description}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(t.transaction_date), "d MMM yyyy")}
                                {t.receipt_path && (
                                  <span className="ml-2 inline-flex items-center gap-1">
                                    <Receipt className="h-3 w-3" />
                                    Receipt
                                  </span>
                                )}
                              </p>
                            </div>
                            <span className="font-medium text-sm">
                              {formatCurrency(Math.abs(t.amount))}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="manual" className="space-y-4">
                <FormField
                  control={form.control}
                  name="purchase_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Quantity</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" step="1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unit_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit Price (£)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" min="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="discount_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Discount Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select discount" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          <SelectItem value="none">None</SelectItem>
                          <SelectItem value="tesco_benefits">Tesco Benefits on Tap (4%)</SelectItem>
                          <SelectItem value="easysaver">EasySaver (7%)</SelectItem>
                          <SelectItem value="clubcard">Clubcard Price</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Discount Preview */}
                {watchedDiscountType !== "none" && watchedDiscountType !== "clubcard" && (
                  <div className="text-sm bg-muted/50 p-3 rounded-md space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>{formatCurrency(discountCalc.originalPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Rounded to (for discount):
                      </span>
                      <span>{formatCurrency(discountCalc.roundedPrice)}</span>
                    </div>
                    <div className="flex justify-between text-primary">
                      <span>Discount ({Math.round(discountCalc.discountPercent * 100)}%):</span>
                      <span>-{formatCurrency(discountCalc.discountAmount)}</span>
                    </div>
                    <div className="flex justify-between font-medium pt-1 border-t">
                      <span>Final Price:</span>
                      <span>{formatCurrency(discountCalc.finalPrice)}</span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Any additional notes..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>
            </Tabs>

            <ResponsiveDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                Link Purchase
              </Button>
            </ResponsiveDialogFooter>
          </form>
        </Form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
