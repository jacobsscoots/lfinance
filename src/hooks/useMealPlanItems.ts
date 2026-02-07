import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { Product, ProductType } from "./useProducts";
import { NutritionSettings } from "./useNutritionSettings";
import { getTargetsForDate } from "@/lib/mealCalculations";
import { calculateMealPortions, PortioningSettings, DEFAULT_PORTIONING_SETTINGS } from "@/lib/autoPortioning";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type MealStatus = "planned" | "skipped" | "eating_out";

export interface MealPlanItem {
  id: string;
  user_id: string;
  meal_plan_id: string;
  product_id: string;
  meal_type: MealType;
  quantity_grams: number;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface MealPlan {
  id: string;
  user_id: string;
  meal_date: string;
  grocery_cycle_id: string | null;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
  snacks: string | null;
  notes: string | null;
  breakfast_status: MealStatus;
  lunch_status: MealStatus;
  dinner_status: MealStatus;
  snack_status: MealStatus;
  eating_out_breakfast_calories: number;
  eating_out_lunch_calories: number;
  eating_out_dinner_calories: number;
  eating_out_snack_calories: number;
  created_at: string;
  updated_at: string;
  items?: MealPlanItem[];
}

export interface MealPlanItemFormData {
  meal_plan_id: string;
  product_id: string;
  meal_type: MealType;
  quantity_grams: number;
  is_locked?: boolean;
}

export function useMealPlanItems(weekStart: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get 7 days starting from weekStart
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date.toISOString().split("T")[0];
  });

  const { data: mealPlans = [], isLoading, error } = useQuery({
    queryKey: ["meal-plans", user?.id, weekStart.toISOString()],
    queryFn: async () => {
      if (!user) return [];
      
      // First, ensure meal_plans exist for each day
      const { data: existingPlans, error: fetchError } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .in("meal_date", weekDates);
      
      if (fetchError) throw fetchError;

      // Create missing days
      const existingDates = new Set(existingPlans?.map(p => p.meal_date) || []);
      const missingDates = weekDates.filter(d => !existingDates.has(d));
      
      if (missingDates.length > 0) {
        const { error: insertError } = await supabase
          .from("meal_plans")
          .insert(missingDates.map(date => ({
            user_id: user.id,
            meal_date: date,
          })));
        
        if (insertError) throw insertError;
      }

      // Now fetch all plans with items
      const { data: plans, error: plansError } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .in("meal_date", weekDates)
        .order("meal_date");
      
      if (plansError) throw plansError;

      // Fetch items for these plans
      const planIds = plans?.map(p => p.id) || [];
      if (planIds.length === 0) return plans as MealPlan[];

      const { data: items, error: itemsError } = await supabase
        .from("meal_plan_items")
        .select(`
          *,
          product:products(*)
        `)
        .in("meal_plan_id", planIds);
      
      if (itemsError) throw itemsError;

      // Attach items to plans
      const itemsByPlan = (items || []).reduce((acc, item) => {
        if (!acc[item.meal_plan_id]) acc[item.meal_plan_id] = [];
        const productData = item.product as unknown as Product | null;
        acc[item.meal_plan_id].push({
          ...item,
          meal_type: item.meal_type as MealType,
          product: productData ? {
            ...productData,
            product_type: productData.product_type as ProductType,
          } : undefined,
        });
        return acc;
      }, {} as Record<string, MealPlanItem[]>);

      return (plans || []).map(plan => ({
        ...plan,
        items: itemsByPlan[plan.id] || [],
      })) as MealPlan[];
    },
    enabled: !!user,
  });

  const addItem = useMutation({
    mutationFn: async (formData: MealPlanItemFormData) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select(`*, product:products(*)`)
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
    onError: (error) => {
      toast.error("Failed to add item: " + error.message);
    },
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...formData }: Partial<MealPlanItemFormData> & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("meal_plan_items")
        .update(formData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
    onError: (error) => {
      toast.error("Failed to update item: " + error.message);
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("meal_plan_items")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
    onError: (error) => {
      toast.error("Failed to remove item: " + error.message);
    },
  });

  const updateMealStatus = useMutation({
    mutationFn: async ({ 
      planId, 
      mealType, 
      status,
      eatingOutCalories 
    }: { 
      planId: string; 
      mealType: MealType; 
      status: MealStatus;
      eatingOutCalories?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const updateData: Record<string, unknown> = {
        [`${mealType}_status`]: status,
      };
      
      if (status === "eating_out" && eatingOutCalories !== undefined) {
        updateData[`eating_out_${mealType}_calories`] = eatingOutCalories;
      }
      
      const { data, error } = await supabase
        .from("meal_plans")
        .update(updateData)
        .eq("id", planId)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
    onError: (error) => {
      toast.error("Failed to update meal status: " + error.message);
    },
  });

  const copyFromPreviousWeek = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Get previous week dates
      const prevWeekDates = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(weekStart);
        date.setDate(date.getDate() - 7 + i);
        return date.toISOString().split("T")[0];
      });

      // Fetch previous week's items
      const { data: prevPlans, error: prevError } = await supabase
        .from("meal_plans")
        .select("*")
        .eq("user_id", user.id)
        .in("meal_date", prevWeekDates);
      
      if (prevError) throw prevError;
      if (!prevPlans || prevPlans.length === 0) {
        throw new Error("No meal plans found in previous week");
      }

      const prevPlanIds = prevPlans.map(p => p.id);
      const { data: prevItems, error: itemsError } = await supabase
        .from("meal_plan_items")
        .select("*")
        .in("meal_plan_id", prevPlanIds);
      
      if (itemsError) throw itemsError;

      // Map previous dates to current week dates
      const dateMap = new Map(prevWeekDates.map((prev, i) => [prev, weekDates[i]]));
      const prevPlanToDate = new Map(prevPlans.map(p => [p.id, p.meal_date]));
      
      // Get current week plans
      const currentPlansByDate = new Map(mealPlans.map(p => [p.meal_date, p]));

      // Copy items
      const newItems = (prevItems || []).map(item => {
        const prevDate = prevPlanToDate.get(item.meal_plan_id);
        const newDate = prevDate ? dateMap.get(prevDate) : null;
        const newPlan = newDate ? currentPlansByDate.get(newDate) : null;
        
        if (!newPlan) return null;
        
        return {
          user_id: user.id,
          meal_plan_id: newPlan.id,
          product_id: item.product_id,
          meal_type: item.meal_type,
          quantity_grams: item.quantity_grams,
          is_locked: item.is_locked,
        };
      }).filter(Boolean);

      if (newItems.length > 0) {
        const { error: insertError } = await supabase
          .from("meal_plan_items")
          .insert(newItems);
        
        if (insertError) throw insertError;
      }

      toast.success(`Copied ${newItems.length} items from previous week`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
    },
    onError: (error) => {
      toast.error("Failed to copy: " + error.message);
    },
  });

  // Track last calculation time
  const [lastCalculated, setLastCalculated] = useState<Date | null>(null);

  const recalculateAll = useMutation({
    mutationFn: async ({ 
      settings, 
      portioningSettings = DEFAULT_PORTIONING_SETTINGS 
    }: { 
      settings: NutritionSettings; 
      portioningSettings?: PortioningSettings;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Import the precision algorithm
      const { calculateDayPortions } = await import("@/lib/autoPortioning");
      
      let totalUpdated = 0;
      let successCount = 0;
      
      for (const plan of mealPlans) {
        const dayDate = new Date(plan.meal_date);
        const targets = getTargetsForDate(dayDate, settings);
        const items = plan.items || [];
        
        if (items.length === 0) continue;
        
        // Use the new precision algorithm that calculates ALL items together
        // with exact calorie/macro matching and even meal distribution
        const result = calculateDayPortions(items, targets, {
          ...portioningSettings,
          rounding: 0, // No rounding for exact precision
          tolerancePercent: 0, // Zero tolerance
        });
        
        if (result.success) successCount++;
        
        // Update each editable, unlocked item with new calculated grams
        for (const item of items) {
          if (item.is_locked) continue;
          if (item.product?.product_type === "fixed") continue;
          
          // Find the grams from the meal results
          const mealResult = result.mealResults.get(item.meal_type);
          const newGrams = mealResult?.items.get(item.id);
          
          if (newGrams !== undefined && Math.abs(newGrams - item.quantity_grams) > 0.1) {
            const { error } = await supabase
              .from("meal_plan_items")
              .update({ quantity_grams: newGrams })
              .eq("id", item.id)
              .eq("user_id", user.id);
            
            if (error) throw error;
            totalUpdated++;
          }
        }
      }
      
      return { updated: totalUpdated, daysSucceeded: successCount, totalDays: mealPlans.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      setLastCalculated(new Date());
      toast.success(
        `Generated exact portions for ${result.daysSucceeded}/${result.totalDays} days` +
        (result.updated > 0 ? ` (${result.updated} items updated)` : "")
      );
    },
    onError: (error) => {
      toast.error("Failed to generate: " + error.message);
    },
  });

  return {
    mealPlans,
    isLoading,
    error,
    addItem,
    updateItem,
    removeItem,
    updateMealStatus,
    copyFromPreviousWeek,
    recalculateAll,
    lastCalculated,
  };
}
