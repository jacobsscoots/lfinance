import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Upload } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  TOILETRY_CATEGORIES, 
  SIZE_UNITS, 
  STATUS_OPTIONS,
  type ToiletryItem 
} from "@/lib/toiletryCalculations";
import { ToiletryImportDialog, ExtractedToiletryData } from "./ToiletryImportDialog";

const toiletryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  brand: z.string().max(100).optional().nullable(),
  category: z.string().min(1, "Category is required"),
  total_size: z.coerce.number().positive("Must be greater than 0"),
  size_unit: z.string().min(1, "Unit is required"),
  cost_per_item: z.coerce.number().min(0, "Cannot be negative"),
  offer_price: z.coerce.number().min(0).optional().nullable(),
  offer_label: z.string().max(100).optional().nullable(),
  pack_size: z.coerce.number().int().min(1, "Must be at least 1"),
  usage_rate_per_day: z.coerce.number().positive("Must be greater than 0"),
  current_remaining: z.coerce.number().min(0, "Cannot be negative"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().max(500).optional(),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
  source_url: z.string().url().optional().nullable().or(z.literal("")),
}).refine(data => data.current_remaining <= data.total_size, {
  message: "Remaining cannot exceed total size",
  path: ["current_remaining"],
});

type ToiletryFormValues = z.infer<typeof toiletryFormSchema>;

interface ToiletryFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ToiletryFormValues) => void;
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
      category: "other",
      total_size: 100,
      size_unit: "ml",
      cost_per_item: 0,
      offer_price: null,
      offer_label: "",
      pack_size: 1,
      usage_rate_per_day: 1,
      current_remaining: 100,
      status: "active",
      notes: "",
      image_url: "",
      source_url: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        brand: (initialData as any).brand || "",
        category: initialData.category,
        total_size: initialData.total_size,
        size_unit: initialData.size_unit,
        cost_per_item: initialData.cost_per_item,
        offer_price: (initialData as any).offer_price || null,
        offer_label: (initialData as any).offer_label || "",
        pack_size: initialData.pack_size,
        usage_rate_per_day: initialData.usage_rate_per_day,
        current_remaining: initialData.current_remaining,
        status: initialData.status,
        notes: initialData.notes || "",
        image_url: (initialData as any).image_url || "",
        source_url: (initialData as any).source_url || "",
      });
    } else {
      form.reset({
        name: "",
        brand: "",
        category: "other",
        total_size: 100,
        size_unit: "ml",
        cost_per_item: 0,
        offer_price: null,
        offer_label: "",
        pack_size: 1,
        usage_rate_per_day: 1,
        current_remaining: 100,
        status: "active",
        notes: "",
        image_url: "",
        source_url: "",
      });
    }
  }, [initialData, form]);

  const handleSubmit = (values: ToiletryFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  const handleImport = (data: ExtractedToiletryData, selectedFields: Set<string>) => {
    if (selectedFields.has("name") && data.name) {
      form.setValue("name", data.name);
    }
    if (selectedFields.has("brand") && data.brand) {
      form.setValue("brand", data.brand);
    }
    if (selectedFields.has("image_url") && data.image_url) {
      form.setValue("image_url", data.image_url);
    }
    if (selectedFields.has("price") && data.price) {
      form.setValue("cost_per_item", data.price);
    }
    if (selectedFields.has("offer_price") && data.offer_price) {
      form.setValue("offer_price", data.offer_price);
    }
    if (selectedFields.has("offer_label") && data.offer_label) {
      form.setValue("offer_label", data.offer_label);
    }
    if (selectedFields.has("pack_size") && data.pack_size) {
      form.setValue("total_size", data.pack_size);
      form.setValue("current_remaining", data.pack_size);
    }
    if (selectedFields.has("size_unit") && data.size_unit) {
      form.setValue("size_unit", data.size_unit);
    }
    if (data.source_url) {
      form.setValue("source_url", data.source_url);
    }
  };

  const currentImageUrl = form.watch("image_url");

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
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
              {/* Image Preview (when editing with existing image) */}
              {isEditing && currentImageUrl && (
                <div className="space-y-2">
                  <FormLabel>Current Image</FormLabel>
                  <img 
                    src={currentImageUrl} 
                    alt={form.watch("name") || "Product"}
                    className="max-h-32 w-full object-contain rounded-lg border bg-muted"
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Shampoo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          {TOILETRY_CATEGORIES.map(cat => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="usage_rate_per_day"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usage per Day</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="current_remaining"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Remaining</FormLabel>
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
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Any additional notes..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
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
