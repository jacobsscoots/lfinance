import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload } from "lucide-react";
import { differenceInDays } from "date-fns";
import { RETAILER_OPTIONS } from "@/hooks/useRetailerProfiles";
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
import { 
  SIZE_UNITS, 
  STATUS_OPTIONS,
  type ToiletryItem 
} from "@/lib/toiletryCalculations";
import { ToiletryImportDialog, ExtractedToiletryData } from "./ToiletryImportDialog";

function formatUsageDuration(days: number | null): string {
  if (days == null || days <= 0) return "—";
  if (days < 7) return `${days} day${days !== 1 ? "s" : ""}`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    const rem = days % 7;
    return rem > 0 ? `${weeks}w ${rem}d` : `${weeks} week${weeks !== 1 ? "s" : ""}`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    const rem = days % 30;
    return rem > 0 ? `${months}m ${rem}d` : `${months} month${months !== 1 ? "s" : ""}`;
  }
  const years = Math.floor(days / 365);
  const rem = days % 365;
  const months = Math.floor(rem / 30);
  return months > 0 ? `${years}y ${months}m` : `${years} year${years !== 1 ? "s" : ""}`;
}

const toiletryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  brand: z.string().max(100).optional().nullable(),
  status: z.string().min(1, "Status is required"),
  total_size: z.coerce.number().positive("Must be greater than 0"),
  size_unit: z.string().min(1, "Unit is required"),
  cost_per_item: z.coerce.number().min(0, "Cannot be negative"),
  offer_price: z.coerce.number().min(0).optional().nullable(),
  offer_label: z.string().max(100).optional().nullable(),
  pack_size: z.coerce.number().int().min(1, "Must be at least 1"),
  opened_at: z.string().optional().nullable(),
  finished_at: z.string().optional().nullable(),
  retailer: z.string().optional().nullable(),
  safety_buffer_days: z.coerce.number().int().min(0).default(2),
});

type ToiletryFormValues = z.infer<typeof toiletryFormSchema>;

interface ToiletryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: any) => void;
  initialData?: ToiletryItem | null;
  isLoading?: boolean;
}

export function ToiletryFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  isLoading = false,
}: ToiletryFormDialogProps) {
  const isEditing = !!initialData;
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const form = useForm<ToiletryFormValues>({
    resolver: zodResolver(toiletryFormSchema),
    defaultValues: {
      name: "",
      brand: "",
      status: "active",
      total_size: 100,
      size_unit: "ml",
      cost_per_item: 0,
      offer_price: null,
      offer_label: "",
      pack_size: 1,
      opened_at: null,
      finished_at: null,
      retailer: null,
      safety_buffer_days: 2,
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        brand: (initialData as any).brand || "",
        status: initialData.status,
        total_size: initialData.total_size,
        size_unit: initialData.size_unit,
        cost_per_item: initialData.cost_per_item,
        offer_price: (initialData as any).offer_price || null,
        offer_label: (initialData as any).offer_label || "",
        pack_size: initialData.pack_size,
        opened_at: initialData.opened_at || null,
        finished_at: initialData.finished_at || null,
        retailer: initialData.retailer || null,
        safety_buffer_days: initialData.safety_buffer_days ?? 2,
      });
    } else {
      form.reset({
        name: "",
        brand: "",
        status: "active",
        total_size: 100,
        size_unit: "ml",
        cost_per_item: 0,
        offer_price: null,
        offer_label: "",
        pack_size: 1,
        opened_at: null,
        finished_at: null,
        retailer: null,
        safety_buffer_days: 2,
      });
    }
  }, [initialData, form]);

  const openedAt = form.watch("opened_at");
  const finishedAt = form.watch("finished_at");

  const usageDays = useMemo(() => {
    if (!openedAt) return null;
    const end = finishedAt ? new Date(finishedAt) : new Date();
    const start = new Date(openedAt);
    const days = differenceInDays(end, start);
    return days > 0 ? days : null;
  }, [openedAt, finishedAt]);

  const handleSubmit = (values: ToiletryFormValues) => {
    // Calculate usage_rate_per_day from dates for backward compat
    let usage_rate_per_day = 1;
    if (values.opened_at) {
      const end = values.finished_at ? new Date(values.finished_at) : new Date();
      const start = new Date(values.opened_at);
      const days = differenceInDays(end, start);
      if (days > 0) {
        usage_rate_per_day = values.total_size / days;
      }
    }

    const current_remaining = values.finished_at 
      ? 0 
      : values.opened_at 
        ? Math.max(0, values.total_size - (usage_rate_per_day * differenceInDays(new Date(), new Date(values.opened_at))))
        : values.total_size;

    onSubmit({
      ...values,
      category: "other",
      usage_rate_per_day,
      current_remaining,
      retailer: values.retailer === "none" ? null : values.retailer,
    });
    onOpenChange(false);
  };

  const handleImport = (data: ExtractedToiletryData, selectedFields: Set<string>) => {
    if (selectedFields.has("name") && data.name) form.setValue("name", data.name);
    if (selectedFields.has("brand") && data.brand) form.setValue("brand", data.brand);
    if (selectedFields.has("price") && data.price) form.setValue("cost_per_item", data.price);
    if (selectedFields.has("offer_price") && data.offer_price) form.setValue("offer_price", data.offer_price);
    if (selectedFields.has("offer_label") && data.offer_label) form.setValue("offer_label", data.offer_label);
    if (selectedFields.has("pack_size") && data.pack_size) {
      form.setValue("total_size", data.pack_size);
    }
    if (selectedFields.has("size_unit") && data.size_unit) form.setValue("size_unit", data.size_unit);
  };

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader className="pr-8">
            <div className="flex items-center justify-between gap-4">
              <ResponsiveDialogTitle>
                {isEditing ? "Edit Item" : "Add Toiletry Item"}
              </ResponsiveDialogTitle>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            </div>
          </ResponsiveDialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Shampoo 400ml" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Brand + Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brand"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Pantene" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          {STATUS_OPTIONS.map(status => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Total Size + Unit */}
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="total_size"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Total Size</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="size_unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          {SIZE_UNITS.map(unit => (
                            <SelectItem key={unit.value} value={unit.value}>
                              {unit.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Price + Offer Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="cost_per_item"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (£)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="offer_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Price (£)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          placeholder="Optional"
                          {...field} 
                          value={field.value ?? ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Offer Label */}
              <FormField
                control={form.control}
                name="offer_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Offer Label</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. 3 for £10, Clubcard Price" 
                        {...field} 
                        value={field.value || ""} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Pack Size */}
              <FormField
                control={form.control}
                name="pack_size"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pack Size (units)</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Usage Start Date + End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="opened_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usage Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="finished_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usage End Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Auto-calculated Usage */}
              {openedAt && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm text-muted-foreground">
                    Usage duration:{" "}
                    <span className="font-semibold text-foreground">
                      {formatUsageDuration(usageDays)}
                    </span>
                    {!finishedAt && <span className="text-xs ml-1">(still in use)</span>}
                  </p>
                </div>
              )}

              {/* Retailer + Safety Buffer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="retailer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retailer</FormLabel>
                      <Select onValueChange={(val) => field.onChange(val === "none" ? null : val)} value={field.value || "none"}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select retailer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          <SelectItem value="none">None</SelectItem>
                          {RETAILER_OPTIONS.map(r => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="safety_buffer_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Safety Buffer (days)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="1" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <ResponsiveDialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isEditing ? "Update" : "Add"} Item
                </Button>
              </ResponsiveDialogFooter>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <ToiletryImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />
    </>
  );
}
