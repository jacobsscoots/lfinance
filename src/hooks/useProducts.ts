import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type ProductType = "editable" | "fixed";
export type ServingBasis = "per_100g" | "per_serving" | "as_sold";
export type FoodType = "protein" | "carb" | "fat" | "veg" | "fruit" | "dairy" | "sauce" | "treat" | "other";
export type MealEligibility = "breakfast" | "lunch" | "dinner" | "snack";
export type EditableMode = "LOCKED" | "BOUNDED" | "FREE";
export type RoundingRule = "nearest_1g" | "nearest_5g" | "nearest_10g" | "whole_unit_only";
export type UnitType = "grams" | "whole_unit";

export interface Product {
  id: string;
  user_id: string;
  name: string;
  brand: string | null;
  // Energy
  energy_kj_per_100g: number;
  calories_per_100g: number;
  // Macros (all per 100g)
  fat_per_100g: number;
  saturates_per_100g: number;
  carbs_per_100g: number;
  sugars_per_100g: number;
  fibre_per_100g: number;
  protein_per_100g: number;
  salt_per_100g: number;
  // Pricing
  price: number;
  offer_price: number | null;
  offer_label: string | null;
  pack_size_grams: number | null;
  // Serving basis
  serving_basis: ServingBasis;
  serving_size_grams: number | null;
  // Product options
  product_type: ProductType;
  fixed_portion_grams: number | null;
  ignore_macros: boolean;
  // Metadata
  source_url: string | null;
  image_url: string | null;
  storage_notes: string | null;
  // Meal planning fields
  meal_eligibility: MealEligibility[];
  food_type: FoodType;
  // Inventory tracking
  quantity_on_hand: number | null;
  quantity_in_use: number | null;
  reorder_threshold: number | null;
  target_quantity: number | null;
  packaging_weight_grams: number | null;
  gross_pack_size_grams: number | null;
  // Grocery tracking
  retailer: string | null;
  default_discount_type: string | null;
  // Portioning engine fields (V2)
  editable_mode: EditableMode;
  min_portion_grams: number | null;
  max_portion_grams: number | null;
  portion_step_grams: number;
  rounding_rule: RoundingRule;
  eaten_factor: number;
  seasoning_rate_per_100g: number | null;
  default_unit_type: UnitType;
  unit_size_g: number | null;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ProductFormData {
  name: string;
  brand?: string | null;
  // Energy
  energy_kj_per_100g?: number;
  calories_per_100g: number;
  // Macros
  fat_per_100g: number;
  saturates_per_100g?: number;
  carbs_per_100g: number;
  sugars_per_100g?: number;
  fibre_per_100g?: number;
  protein_per_100g: number;
  salt_per_100g?: number;
  // Pricing
  price: number;
  offer_price?: number | null;
  offer_label?: string | null;
  pack_size_grams?: number | null;
  // Grocery tracking
  retailer?: string | null;
  default_discount_type?: string | null;
  // Serving basis
  serving_basis?: ServingBasis;
  serving_size_grams?: number | null;
  // Product options
  product_type: ProductType;
  fixed_portion_grams?: number | null;
  ignore_macros: boolean;
  // Metadata
  source_url?: string | null;
  image_url?: string | null;
  storage_notes?: string | null;
  // Meal planning fields
  meal_eligibility?: MealEligibility[];
  food_type?: FoodType;
  // Portioning engine fields (V2)
  editable_mode?: EditableMode;
  min_portion_grams?: number | null;
  max_portion_grams?: number | null;
  portion_step_grams?: number;
  rounding_rule?: RoundingRule;
  eaten_factor?: number;
  seasoning_rate_per_100g?: number | null;
  default_unit_type?: UnitType;
  unit_size_g?: number | null;
}

// Conversion helpers
export const KJ_TO_KCAL = 4.184;

export function kjToKcal(kj: number): number {
  return Math.round(kj / KJ_TO_KCAL);
}

export function kcalToKj(kcal: number): number {
  return Math.round(kcal * KJ_TO_KCAL);
}

export function sodiumToSalt(sodium: number): number {
  return sodium * 2.5;
}

// Convert values to per-100g basis
export function convertToPerHundredGrams(
  value: number,
  basis: ServingBasis,
  servingSize: number | null | undefined
): number {
  if (basis === "per_100g" || !servingSize) return value;
  return (value / servingSize) * 100;
}

export function useProducts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ["products", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!user,
  });

  const createProduct = useMutation({
    mutationFn: async (formData: ProductFormData) => {
      if (!user) throw new Error("Not authenticated");
      
      // Convert all values to per-100g before saving
      const basis = formData.serving_basis || "per_100g";
      const servingSize = formData.serving_size_grams;
      
      const dataToSave = {
        ...formData,
        user_id: user.id,
        energy_kj_per_100g: convertToPerHundredGrams(formData.energy_kj_per_100g || 0, basis, servingSize),
        calories_per_100g: convertToPerHundredGrams(formData.calories_per_100g, basis, servingSize),
        fat_per_100g: convertToPerHundredGrams(formData.fat_per_100g, basis, servingSize),
        saturates_per_100g: convertToPerHundredGrams(formData.saturates_per_100g || 0, basis, servingSize),
        carbs_per_100g: convertToPerHundredGrams(formData.carbs_per_100g, basis, servingSize),
        sugars_per_100g: convertToPerHundredGrams(formData.sugars_per_100g || 0, basis, servingSize),
        fibre_per_100g: convertToPerHundredGrams(formData.fibre_per_100g || 0, basis, servingSize),
        protein_per_100g: convertToPerHundredGrams(formData.protein_per_100g, basis, servingSize),
        salt_per_100g: convertToPerHundredGrams(formData.salt_per_100g || 0, basis, servingSize),
      };

      const { data, error } = await supabase
        .from("products")
        .insert(dataToSave)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
    },
    onError: (error) => {
      toast.error("Failed to create product: " + error.message);
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({ id, ...formData }: ProductFormData & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Convert all values to per-100g before saving
      const basis = formData.serving_basis || "per_100g";
      const servingSize = formData.serving_size_grams;
      
      const dataToSave = {
        ...formData,
        energy_kj_per_100g: convertToPerHundredGrams(formData.energy_kj_per_100g || 0, basis, servingSize),
        calories_per_100g: convertToPerHundredGrams(formData.calories_per_100g, basis, servingSize),
        fat_per_100g: convertToPerHundredGrams(formData.fat_per_100g, basis, servingSize),
        saturates_per_100g: convertToPerHundredGrams(formData.saturates_per_100g || 0, basis, servingSize),
        carbs_per_100g: convertToPerHundredGrams(formData.carbs_per_100g, basis, servingSize),
        sugars_per_100g: convertToPerHundredGrams(formData.sugars_per_100g || 0, basis, servingSize),
        fibre_per_100g: convertToPerHundredGrams(formData.fibre_per_100g || 0, basis, servingSize),
        protein_per_100g: convertToPerHundredGrams(formData.protein_per_100g, basis, servingSize),
        salt_per_100g: convertToPerHundredGrams(formData.salt_per_100g || 0, basis, servingSize),
      };

      const { data, error } = await supabase
        .from("products")
        .update(dataToSave)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
    },
    onError: (error) => {
      toast.error("Failed to update product: " + error.message);
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete product: " + error.message);
    },
  });

  const duplicateProduct = useMutation({
    mutationFn: async (product: Product) => {
      if (!user) throw new Error("Not authenticated");
      
      const { id, created_at, updated_at, ...productData } = product;
      
      const { data, error } = await supabase
        .from("products")
        .insert({
          ...productData,
          name: `${product.name} (copy)`,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product duplicated");
    },
    onError: (error) => {
      toast.error("Failed to duplicate product: " + error.message);
    },
  });

  return {
    products,
    isLoading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    duplicateProduct,
  };
}
