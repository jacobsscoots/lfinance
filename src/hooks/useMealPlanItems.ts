import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { addDays, parse } from "date-fns";
import { Product, ProductType } from "./useProducts";
import { NutritionSettings } from "./useNutritionSettings";
import { getDailyTargets, WeeklyTargetsOverride } from "@/lib/dailyTargets";
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

import { getShoppingWeekRange, getShoppingWeekDateStrings, ShoppingWeekRange } from "@/lib/mealPlannerWeek";

export function useMealPlanItems(weekStart: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get shopping week range (Sun→Mon, 9 days)
  const weekRange = getShoppingWeekRange(weekStart);
  const weekDates = getShoppingWeekDateStrings(weekRange);

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

  // Batch insert multiple items at once
  const addMultipleItems = useMutation({
    mutationFn: async (items: Omit<MealPlanItemFormData, "is_locked">[]) => {
      if (!user) throw new Error("Not authenticated");
      if (items.length === 0) return [];
      
      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert(items.map(item => ({ ...item, user_id: user.id })))
        .select(`*, product:products(*)`);
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success(`Added ${data?.length || 0} items`);
    },
    onError: (error) => {
      toast.error("Failed to add items: " + error.message);
    },
  });

  // Copy all items from one day to the next day
  const copyDayToNext = useMutation({
    mutationFn: async ({ sourcePlanId, sourcePlanDate }: { sourcePlanId: string; sourcePlanDate: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Find source plan items
      const sourcePlan = mealPlans.find(p => p.id === sourcePlanId);
      if (!sourcePlan || !sourcePlan.items || sourcePlan.items.length === 0) {
        throw new Error("No items to copy");
      }

      // Find next day's plan
      const sourceIndex = weekDates.indexOf(sourcePlanDate);
      if (sourceIndex === -1 || sourceIndex >= weekDates.length - 1) {
        throw new Error("Cannot copy to next day - end of week");
      }

      const nextDate = weekDates[sourceIndex + 1];
      const targetPlan = mealPlans.find(p => p.meal_date === nextDate);
      if (!targetPlan) {
        throw new Error("Next day plan not found");
      }

      // Create copies of all items
      const newItems = sourcePlan.items.map(item => ({
        user_id: user.id,
        meal_plan_id: targetPlan.id,
        product_id: item.product_id,
        meal_type: item.meal_type,
        quantity_grams: item.quantity_grams,
        // Don't copy is_locked status
      }));

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert(newItems)
        .select();
      
      if (error) throw error;
      return { count: data?.length || 0, targetDate: nextDate };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success(`Copied ${result.count} items to ${result.targetDate}`);
    },
    onError: (error) => {
      toast.error("Failed to copy: " + error.message);
    },
  });

  // Clear all items from a specific day
  const clearDay = useMutation({
    mutationFn: async (planId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("meal_plan_items")
        .delete()
        .eq("meal_plan_id", planId)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success("Reset day");
    },
    onError: (error) => {
      toast.error("Failed to reset: " + error.message);
    },
  });

  // Clear all items from the entire week
  const clearWeek = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      
      // Get all plan IDs for this week
      const planIds = mealPlans.map(p => p.id);
      
      if (planIds.length === 0) {
        throw new Error("No plans to clear");
      }
      
      // Delete all items from all plans
      const { error } = await supabase
        .from("meal_plan_items")
        .delete()
        .eq("user_id", user.id)
        .in("meal_plan_id", planIds);
      
      if (error) throw error;
      
      return { plansCleared: planIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success(`Reset ${result.plansCleared} days`);
    },
    onError: (error) => {
      toast.error("Failed to reset week: " + error.message);
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
      
      // Get previous week dates (using the shopping week range - 9 days)
      const prevWeekDates = Array.from({ length: 9 }, (_, i) => {
        const date = addDays(weekRange.start, -9 + i);
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

  // Generate portions for a single day (best-effort compute first; only write to DB on success)
  const recalculateDay = useMutation({
    mutationFn: async ({ 
      planId,
      settings, 
      portioningSettings = DEFAULT_PORTIONING_SETTINGS,
      weeklyOverride
    }: { 
      planId: string;
      settings: NutritionSettings; 
      portioningSettings?: PortioningSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const plan = mealPlans.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");
      
      const items = plan.items || [];
      if (items.length === 0) throw new Error("No items to generate");
      
      const { calculateDayPortions } = await import("@/lib/autoPortioning");
      
      // Parse as local date to avoid UTC-shift target mismatches.
      const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
      // Use unified getDailyTargets for single source of truth
      const targets = getDailyTargets(dayDate, settings, weeklyOverride);

      // Virtualize unlocked editable items as 0g for the solve (regen behavior),
      // but do NOT write 0g to the DB unless the solve succeeds.
      const virtualItems = items.map(item => ({
        ...item,
        quantity_grams:
          item.is_locked || item.product?.product_type === "fixed" ? item.quantity_grams : 0,
      }));
      
      const result = calculateDayPortions(virtualItems, targets, {
        ...portioningSettings,
        rounding: 0,
        tolerancePercent: 0,
      }, plan.meal_date);

      if (!result.success) {
        // Don’t apply a bad solve—return warnings so the UI can show the reason.
        return { success: false as const, updated: 0, warnings: result.warnings };
      }
      
      let updated = 0;
      for (const item of items) {
        if (item.is_locked) continue;
        if (item.product?.product_type === "fixed") continue;
        
        const mealResult = result.mealResults.get(item.meal_type as MealType);
        const newGrams = mealResult?.items.get(item.id);
        
        if (newGrams !== undefined) {
          const { error } = await supabase
            .from("meal_plan_items")
            .update({ quantity_grams: newGrams })
            .eq("id", item.id)
            .eq("user_id", user.id);
          
          if (error) throw error;
          updated++;
        }
      }
      
      return { success: true as const, updated, warnings: result.warnings };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      setLastCalculated(new Date());

      if (result.success) {
        toast.success(`Generated portions (${result.updated} items)`);
      } else {
        toast.error(result.warnings?.[0] ?? "Targets not solvable with current fixed/locked items and constraints.");
      }
    },
    onError: (error) => {
      toast.error("Failed to generate: " + error.message);
    },
  });


  const recalculateAll = useMutation({
    mutationFn: async ({ 
      settings, 
      portioningSettings = DEFAULT_PORTIONING_SETTINGS,
      weeklyOverride
    }: { 
      settings: NutritionSettings; 
      portioningSettings?: PortioningSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { calculateDayPortions } = await import("@/lib/autoPortioning");
      
      let totalUpdated = 0;
      let successCount = 0;
      
      for (const plan of mealPlans) {
        const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
        // Use unified getDailyTargets for single source of truth
        const targets = getDailyTargets(dayDate, settings, weeklyOverride);
        const items = plan.items || [];
        
        if (items.length === 0) continue;
        
        // First, reset all unlocked editable items to 0g (re-generate behavior)
        for (const item of items) {
          if (item.is_locked) continue;
          if (item.product?.product_type === "fixed") continue;
          
          if (item.quantity_grams > 0) {
            await supabase
              .from("meal_plan_items")
              .update({ quantity_grams: 0 })
              .eq("id", item.id)
              .eq("user_id", user.id);
          }
        }
        
        // Recalculate with fresh zeroed values
        const result = calculateDayPortions(items.map(i => ({
          ...i,
          quantity_grams: i.is_locked ? i.quantity_grams : 0,
        })), targets, {
          ...portioningSettings,
          rounding: 0,
          tolerancePercent: 0,
        }, plan.meal_date);
        
        if (result.success) successCount++;
        
        // Update each editable, unlocked item with new calculated grams
        for (const item of items) {
          if (item.is_locked) continue;
          if (item.product?.product_type === "fixed") continue;
          
          const mealResult = result.mealResults.get(item.meal_type);
          const newGrams = mealResult?.items.get(item.id);
          
          if (newGrams !== undefined && newGrams > 0) {
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
    weekRange,
    weekDates,
    isLoading,
    error,
    addItem,
    addMultipleItems,
    updateItem,
    removeItem,
    updateMealStatus,
    copyFromPreviousWeek,
    copyDayToNext,
    clearDay,
    clearWeek,
    recalculateDay,
    recalculateAll,
    lastCalculated,
  };
}
