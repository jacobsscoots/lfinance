import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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

const toiletryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  category: z.string().min(1, "Category is required"),
  total_size: z.coerce.number().positive("Must be greater than 0"),
  size_unit: z.string().min(1, "Unit is required"),
  cost_per_item: z.coerce.number().min(0, "Cannot be negative"),
  pack_size: z.coerce.number().int().min(1, "Must be at least 1"),
  usage_rate_per_day: z.coerce.number().positive("Must be greater than 0"),
  current_remaining: z.coerce.number().min(0, "Cannot be negative"),
  status: z.string().min(1, "Status is required"),
  notes: z.string().max(500).optional(),
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
  
  const form = useForm<ToiletryFormValues>({
    resolver: zodResolver(toiletryFormSchema),
    defaultValues: {
      name: "",
      category: "other",
      total_size: 100,
      size_unit: "ml",
      cost_per_item: 0,
      pack_size: 1,
      usage_rate_per_day: 1,
      current_remaining: 100,
      status: "active",
      notes: "",
    },
  });

  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        category: initialData.category,
        total_size: initialData.total_size,
        size_unit: initialData.size_unit,
        cost_per_item: initialData.cost_per_item,
        pack_size: initialData.pack_size,
        usage_rate_per_day: initialData.usage_rate_per_day,
        current_remaining: initialData.current_remaining,
        status: initialData.status,
        notes: initialData.notes || "",
      });
    } else {
      form.reset({
        name: "",
        category: "other",
        total_size: 100,
        size_unit: "ml",
        cost_per_item: 0,
        pack_size: 1,
        usage_rate_per_day: 1,
        current_remaining: 100,
        status: "active",
        notes: "",
      });
    }
  }, [initialData, form]);

  const handleSubmit = (values: ToiletryFormValues) => {
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEditing ? "Edit Item" : "Add Toiletry Item"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                    <FormLabel>Cost per Item (£)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" min="0" {...field} />
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
                    <FormLabel>Pack Size</FormLabel>
                    <FormControl>
                      <Input type="number" step="1" min="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
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
  );
}
