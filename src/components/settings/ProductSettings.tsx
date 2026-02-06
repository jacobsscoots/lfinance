import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Trash2, Package, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useProducts, Product, ProductFormData, ProductType } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  calories_per_100g: z.coerce.number().min(0),
  protein_per_100g: z.coerce.number().min(0),
  carbs_per_100g: z.coerce.number().min(0),
  fat_per_100g: z.coerce.number().min(0),
  price: z.coerce.number().min(0),
  pack_size_grams: z.coerce.number().min(0).nullable().optional(),
  product_type: z.enum(["editable", "fixed"]),
  fixed_portion_grams: z.coerce.number().min(0).nullable().optional(),
  ignore_macros: z.boolean(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductFormDialogProps {
  product?: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ProductFormDialog({ product, open, onOpenChange }: ProductFormDialogProps) {
  const { createProduct, updateProduct } = useProducts();
  const isEditing = !!product;

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name || "",
      calories_per_100g: product?.calories_per_100g || 0,
      protein_per_100g: product?.protein_per_100g || 0,
      carbs_per_100g: product?.carbs_per_100g || 0,
      fat_per_100g: product?.fat_per_100g || 0,
      price: product?.price || 0,
      pack_size_grams: product?.pack_size_grams || null,
      product_type: (product?.product_type as ProductType) || "editable",
      fixed_portion_grams: product?.fixed_portion_grams || null,
      ignore_macros: product?.ignore_macros || false,
    },
  });

  const productType = form.watch("product_type");

  async function onSubmit(values: ProductFormValues) {
    const data: ProductFormData = {
      name: values.name,
      calories_per_100g: values.calories_per_100g,
      protein_per_100g: values.protein_per_100g,
      carbs_per_100g: values.carbs_per_100g,
      fat_per_100g: values.fat_per_100g,
      price: values.price,
      pack_size_grams: values.pack_size_grams || null,
      product_type: values.product_type,
      fixed_portion_grams: values.product_type === "fixed" ? values.fixed_portion_grams : null,
      ignore_macros: values.ignore_macros,
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Chicken Breast" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="product_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormMessage />
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="calories_per_100g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Calories /100g</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="protein_per_100g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Protein /100g</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="carbs_per_100g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Carbs /100g</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fat_per_100g"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fat /100g</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    <FormDescription>Per pack or per 100g</FormDescription>
                    <FormMessage />
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
                      <Input type="number" step="1" placeholder="Optional" {...field} value={field.value ?? ""} />
                    </FormControl>
                    <FormDescription>Leave empty if sold by weight</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                {isEditing ? "Save" : "Add Product"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductSettings() {
  const { products, isLoading, deleteProduct } = useProducts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>();

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingProduct(undefined);
    setDialogOpen(true);
  };

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Products
        </CardTitle>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-1" />
          Add Product
        </Button>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No products yet. Add your first product to start meal planning.
          </p>
        ) : (
          <div className="space-y-2">
            {products.map(product => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{product.name}</span>
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
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => deleteProduct.mutate(product.id)}
                    disabled={deleteProduct.isPending}
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
