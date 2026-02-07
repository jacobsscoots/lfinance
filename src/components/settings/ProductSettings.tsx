import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, Scale, Copy, Upload, Search, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProducts, Product, ProductFormData, ProductType, ServingBasis, FoodType, MealEligibility, kjToKcal, kcalToKj } from "@/hooks/useProducts";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { NutritionImportDialog } from "./NutritionImportDialog";
import { ExtractedNutrition } from "@/lib/nutritionExtraction";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";

const productSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  brand: z.string().max(100).optional().nullable(),
  // Energy
  energy_kj_per_100g: z.coerce.number().min(0).optional().nullable(),
  calories_per_100g: z.coerce.number().min(0),
  // Macros
  fat_per_100g: z.coerce.number().min(0),
  saturates_per_100g: z.coerce.number().min(0).optional(),
  carbs_per_100g: z.coerce.number().min(0),
  sugars_per_100g: z.coerce.number().min(0).optional(),
  fibre_per_100g: z.coerce.number().min(0).optional(),
  protein_per_100g: z.coerce.number().min(0),
  salt_per_100g: z.coerce.number().min(0).optional(),
  // Pricing
  price: z.coerce.number().min(0),
  offer_price: z.coerce.number().min(0).optional().nullable(),
  offer_label: z.string().max(50).optional().nullable(),
  pack_size_grams: z.coerce.number().min(0).nullable().optional(),
  // Serving basis
  serving_basis: z.enum(["per_100g", "per_serving", "as_sold"]),
  serving_size_grams: z.coerce.number().min(0).nullable().optional(),
  // Product options
  product_type: z.enum(["editable", "fixed"]),
  fixed_portion_grams: z.coerce.number().min(0).nullable().optional(),
  ignore_macros: z.boolean(),
  // Metadata
  source_url: z.string().url().optional().nullable().or(z.literal("")),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
  storage_notes: z.string().max(500).optional().nullable(),
  // Meal planning
  meal_eligibility: z.array(z.enum(["breakfast", "lunch", "dinner", "snack"])),
  food_type: z.enum(["protein", "carb", "fat", "veg", "fruit", "dairy", "sauce", "treat", "other"]),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  product?: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProductFormDialog({ product, open, onOpenChange }: ProductFormDialogProps) {
  const { createProduct, updateProduct } = useProducts();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const isEditing = !!product;

  const getDefaultValues = useCallback(() => ({
    name: "",
    brand: "",
    energy_kj_per_100g: null,
    calories_per_100g: 0,
    fat_per_100g: 0,
    saturates_per_100g: 0,
    carbs_per_100g: 0,
    sugars_per_100g: 0,
    fibre_per_100g: 0,
    protein_per_100g: 0,
    salt_per_100g: 0,
    price: 0,
    offer_price: null,
    offer_label: "",
    pack_size_grams: null,
    serving_basis: "per_100g" as ServingBasis,
    serving_size_grams: null,
    product_type: "editable" as ProductType,
    fixed_portion_grams: null,
    ignore_macros: false,
    source_url: "",
    image_url: "",
    storage_notes: "",
    meal_eligibility: ["breakfast", "lunch", "dinner", "snack"] as MealEligibility[],
    food_type: "other" as FoodType,
  }), []);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: getDefaultValues(),
  });

  // Reset form when product changes (fixes edit prefilling)
  useEffect(() => {
    if (product) {
      form.reset({
        name: product.name,
        brand: product.brand || "",
        energy_kj_per_100g: product.energy_kj_per_100g || null,
        calories_per_100g: product.calories_per_100g || 0,
        fat_per_100g: product.fat_per_100g || 0,
        saturates_per_100g: product.saturates_per_100g || 0,
        carbs_per_100g: product.carbs_per_100g || 0,
        sugars_per_100g: product.sugars_per_100g || 0,
        fibre_per_100g: product.fibre_per_100g || 0,
        protein_per_100g: product.protein_per_100g || 0,
        salt_per_100g: product.salt_per_100g || 0,
        price: product.price || 0,
        offer_price: product.offer_price || null,
        offer_label: product.offer_label || "",
        pack_size_grams: product.pack_size_grams || null,
        serving_basis: (product.serving_basis as ServingBasis) || "per_100g",
        serving_size_grams: product.serving_size_grams || null,
        product_type: (product.product_type as ProductType) || "editable",
        fixed_portion_grams: product.fixed_portion_grams || null,
        ignore_macros: product.ignore_macros || false,
        source_url: product.source_url || "",
        image_url: product.image_url || "",
        storage_notes: product.storage_notes || "",
        meal_eligibility: product.meal_eligibility || ["breakfast", "lunch", "dinner", "snack"],
        food_type: (product.food_type as FoodType) || "other",
      });
    } else {
      form.reset(getDefaultValues());
    }
  }, [product, form, getDefaultValues]);

  const productType = form.watch("product_type");
  const servingBasis = form.watch("serving_basis");
  const energyKj = form.watch("energy_kj_per_100g");
  const energyKcal = form.watch("calories_per_100g");

  // Auto-convert energy values
  const handleKjChange = useCallback((value: number | null) => {
    if (value && value > 0) {
      const kcal = kjToKcal(value);
      const currentKcal = form.getValues("calories_per_100g");
      // Only auto-update if kcal is empty or significantly different
      if (!currentKcal || Math.abs(currentKcal - kcal) > 5) {
        form.setValue("calories_per_100g", kcal);
      }
    }
  }, [form]);

  const handleKcalChange = useCallback((value: number) => {
    if (value > 0) {
      const kj = kcalToKj(value);
      const currentKj = form.getValues("energy_kj_per_100g");
      // Only auto-update if kJ is empty or significantly different
      if (!currentKj || Math.abs(currentKj - kj) > 20) {
        form.setValue("energy_kj_per_100g", kj);
      }
    }
  }, [form]);

  // Handle import from nutrition dialog
  const handleImport = (extracted: ExtractedNutrition, selectedFields: Set<string>) => {
    if (selectedFields.has("name") && extracted.name) {
      form.setValue("name", extracted.name);
    }
    if (selectedFields.has("brand") && extracted.brand) {
      form.setValue("brand", extracted.brand);
    }
    if (selectedFields.has("energy_kj") && extracted.energy_kj) {
      form.setValue("energy_kj_per_100g", extracted.energy_kj);
    }
    if (selectedFields.has("energy_kcal") && extracted.energy_kcal) {
      form.setValue("calories_per_100g", extracted.energy_kcal);
    }
    if (selectedFields.has("fat") && extracted.fat !== undefined) {
      form.setValue("fat_per_100g", extracted.fat);
    }
    if (selectedFields.has("saturates") && extracted.saturates !== undefined) {
      form.setValue("saturates_per_100g", extracted.saturates);
    }
    if (selectedFields.has("carbohydrate") && extracted.carbohydrate !== undefined) {
      form.setValue("carbs_per_100g", extracted.carbohydrate);
    }
    if (selectedFields.has("sugars") && extracted.sugars !== undefined) {
      form.setValue("sugars_per_100g", extracted.sugars);
    }
    if (selectedFields.has("fibre") && extracted.fibre !== undefined) {
      form.setValue("fibre_per_100g", extracted.fibre);
    }
    if (selectedFields.has("protein") && extracted.protein !== undefined) {
      form.setValue("protein_per_100g", extracted.protein);
    }
    if (selectedFields.has("salt") && extracted.salt !== undefined) {
      form.setValue("salt_per_100g", extracted.salt);
    }
    if (selectedFields.has("price") && extracted.price) {
      form.setValue("price", extracted.price);
    }
    if (selectedFields.has("offer_price") && extracted.offer_price) {
      form.setValue("offer_price", extracted.offer_price);
    }
    if (selectedFields.has("pack_size_grams") && extracted.pack_size_grams) {
      form.setValue("pack_size_grams", extracted.pack_size_grams);
    }
    if (extracted.source_url) {
      form.setValue("source_url", extracted.source_url);
    }
    if (selectedFields.has("image_url") && extracted.image_url) {
      form.setValue("image_url", extracted.image_url);
    }
  };

  async function onSubmit(values: ProductFormValues) {
    const data: ProductFormData = {
      name: values.name,
      brand: values.brand || null,
      energy_kj_per_100g: values.energy_kj_per_100g || 0,
      calories_per_100g: values.calories_per_100g,
      fat_per_100g: values.fat_per_100g,
      saturates_per_100g: values.saturates_per_100g || 0,
      carbs_per_100g: values.carbs_per_100g,
      sugars_per_100g: values.sugars_per_100g || 0,
      fibre_per_100g: values.fibre_per_100g || 0,
      protein_per_100g: values.protein_per_100g,
      salt_per_100g: values.salt_per_100g || 0,
      price: values.price,
      offer_price: values.offer_price || null,
      offer_label: values.offer_label || null,
      pack_size_grams: values.pack_size_grams || null,
      serving_basis: values.serving_basis,
      serving_size_grams: values.serving_size_grams || null,
      product_type: values.product_type,
      fixed_portion_grams: values.product_type === "fixed" ? values.fixed_portion_grams : null,
      ignore_macros: values.ignore_macros,
      source_url: values.source_url || null,
      image_url: values.image_url || null,
      storage_notes: values.storage_notes || null,
      meal_eligibility: values.meal_eligibility,
      food_type: values.food_type,
    };

    if (isEditing) {
      await updateProduct.mutateAsync({ id: product.id, ...data });
    } else {
      await createProduct.mutateAsync(data);
    }
    onOpenChange(false);
    form.reset();
  }

  return (
    <>
      <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
        <ResponsiveDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <ResponsiveDialogHeader>
            <div className="flex items-center justify-between gap-4">
              <ResponsiveDialogTitle>{isEditing ? "Edit Product" : "Add Product"}</ResponsiveDialogTitle>
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Image Preview (when editing with existing image) */}
              {isEditing && product?.image_url && (
                <div className="space-y-2">
                  <FormLabel>Current Image</FormLabel>
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="max-h-32 w-full object-contain rounded-lg border bg-muted"
                  />
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Greek Yogurt" {...field} />
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
                        <Input placeholder="e.g. Fage" {...field} value={field.value || ""} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Serving Basis */}
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="serving_basis"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Values entered as</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="per_100g">Per 100g</SelectItem>
                          <SelectItem value="per_serving">Per serving</SelectItem>
                          <SelectItem value="as_sold">As sold (per pack/item)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Values will be converted to per 100g for storage
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {(servingBasis === "per_serving" || servingBasis === "as_sold") && (
                  <FormField
                    control={form.control}
                    name="serving_size_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {servingBasis === "per_serving" ? "Serving size (g)" : "Pack/item size (g)"} *
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            placeholder="e.g. 150" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              <Separator />

              {/* Nutrition (UK label order) */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Nutrition Information</h4>
                
                {/* Energy */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="energy_kj_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Energy (kJ)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            placeholder="e.g. 1680"
                            {...field} 
                            value={field.value ?? ""} 
                            onChange={(e) => {
                              const val = e.target.value ? Number(e.target.value) : null;
                              field.onChange(val);
                              handleKjChange(val);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="calories_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Energy (kcal) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            placeholder="e.g. 402"
                            {...field} 
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              field.onChange(val);
                              handleKcalChange(val);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fat & Saturates */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fat_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fat (g) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="saturates_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">of which Saturates (g)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Carbs & Sugars */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="carbs_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Carbohydrate (g) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sugars_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-muted-foreground">of which Sugars (g)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Fibre, Protein, Salt */}
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="fibre_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fibre (g)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="protein_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protein (g) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.1" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salt_per_100g"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Salt (g)
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>If label shows sodium, multiply by 2.5</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Price (£)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="pack_size_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pack Size (g)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="1" 
                            placeholder="Optional" 
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                            placeholder="Optional"
                            {...field} 
                            value={field.value ?? ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="offer_label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Offer Label</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. Clubcard Price" 
                            {...field} 
                            value={field.value || ""} 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* Product Options */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Options</h4>
                
                <FormField
                  control={form.control}
                  name="product_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="editable">
                            <div className="flex items-center gap-2">
                              <Scale className="h-4 w-4" />
                              Editable (raw ingredient)
                            </div>
                          </SelectItem>
                          <SelectItem value="fixed">
                            <div className="flex items-center gap-2">
                              <Package className="h-4 w-4" />
                              Fixed (pre-packaged)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {productType === "fixed" 
                          ? "Fixed portion size - system will not adjust" 
                          : "Can be scaled by the system to meet targets"}
                      </FormDescription>
                    </FormItem>
                  )}
                />

                {productType === "fixed" && (
                  <FormField
                    control={form.control}
                    name="fixed_portion_grams"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fixed Portion Size (g)</FormLabel>
                        <FormControl>
                          <Input type="number" step="1" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription>The locked portion size for this item</FormDescription>
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="ignore_macros"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Ignore Macros</FormLabel>
                        <FormDescription>
                          Include in grocery list but exclude from nutrition calculations
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <Separator />

              {/* Meal Planning */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Meal Planning</h4>
                
                <FormField
                  control={form.control}
                  name="meal_eligibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Allowed Meals</FormLabel>
                      <FormDescription>Which meals can this product appear in?</FormDescription>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {(["breakfast", "lunch", "dinner", "snack"] as const).map((meal) => (
                          <label 
                            key={meal}
                            className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-accent"
                          >
                            <Checkbox
                              checked={field.value?.includes(meal)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, meal]);
                                } else {
                                  field.onChange(field.value.filter((m: string) => m !== meal));
                                }
                              }}
                            />
                            <span className="text-sm capitalize">{meal}</span>
                          </label>
                        ))}
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="food_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Food Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="protein">Protein</SelectItem>
                          <SelectItem value="carb">Carb</SelectItem>
                          <SelectItem value="fat">Fat</SelectItem>
                          <SelectItem value="veg">Vegetable</SelectItem>
                          <SelectItem value="fruit">Fruit</SelectItem>
                          <SelectItem value="dairy">Dairy</SelectItem>
                          <SelectItem value="sauce">Sauce/Condiment</SelectItem>
                          <SelectItem value="treat">Treat</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>Helps with smart meal composition</FormDescription>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {isEditing ? "Save" : "Add Product"}
                </Button>
              </div>
            </form>
          </Form>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      <NutritionImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImport={handleImport}
      />
    </>
  );
}

export function ProductSettings() {
  const { products, isLoading, deleteProduct, duplicateProduct } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(undefined);
    setDialogOpen(true);
  };

  const handleDuplicate = (product: Product) => {
    duplicateProduct.mutate(product);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.brand?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Products
        </CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">Add Product</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {products.length === 0 
              ? "No products yet. Add your first product to start meal planning."
              : "No products match your search."}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{product.name}</span>
                    {product.brand && (
                      <span className="text-sm text-muted-foreground">({product.brand})</span>
                    )}
                    {product.product_type === "fixed" && (
                      <Badge variant="secondary" className="text-xs">
                        <Package className="h-3 w-3 mr-1" />
                        Fixed
                      </Badge>
                    )}
                    {product.ignore_macros && (
                      <Badge variant="outline" className="text-xs">Ignore macros</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {product.calories_per_100g} kcal | P: {product.protein_per_100g}g | C: {product.carbs_per_100g}g | F: {product.fat_per_100g}g
                    {product.pack_size_grams && ` | Pack: ${product.pack_size_grams}g`}
                    {product.price > 0 && ` | £${product.price.toFixed(2)}`}
                    {product.offer_price && (
                      <span className="text-primary"> (£{product.offer_price.toFixed(2)} offer)</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDuplicate(product)} title="Duplicate">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(product)} title="Edit">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteProduct.mutate(product.id)}
                    disabled={deleteProduct.isPending}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ProductFormDialog 
        product={editingProduct} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />
    </Card>
  );
}
