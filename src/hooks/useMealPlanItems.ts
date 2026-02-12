import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { addDays, parse, format } from "date-fns";
import { Product, ProductType } from "./useProducts";
import { NutritionSettings } from "./useNutritionSettings";
import { getDailyTargets, WeeklyTargetsOverride } from "@/lib/dailyTargets";
// Legacy import for fallback (deprecated)
import { PortioningSettings, DEFAULT_PORTIONING_SETTINGS } from "@/lib/autoPortioning";
// V2 portioning engine (new)
import { solve, productToSolverItem } from "@/lib/portioningEngine";
import { SolverItem, SolverTargets, DEFAULT_SOLVER_OPTIONS, MealType as SolverMealType, SolverFailed } from "@/lib/portioningTypes";
import { shouldCapAsSeasoning, DEFAULT_SEASONING_MAX_GRAMS, DEFAULT_SEASONING_FALLBACK_GRAMS } from "@/lib/seasoningRules";

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

import { getShoppingWeekRange, getShoppingWeekDateStrings } from "@/lib/mealPlannerWeek";

export function useMealPlanItems(weekStart: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get shopping week range (Sun→Mon, 9 days)
  const weekRange = getShoppingWeekRange(weekStart);
  const weekDates = getShoppingWeekDateStrings(weekRange);

  // Stable query key: use YYYY-MM-DD string instead of toISOString()
  // toISOString() includes timezone-dependent time components that can
  // create inconsistent cache keys across timezone boundaries.
  const weekStartKey = format(weekRange.start, "yyyy-MM-dd");

  const { data: mealPlans = [], isLoading, error } = useQuery({
    queryKey: ["meal-plans", user?.id, weekStartKey],
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

      // Create copies of all items, clamping seasonings (Fix B2)
      const newItems = sourcePlan.items.map(item => {
        let quantity = item.quantity_grams;
        
        // Clamp seasonings to max 15g during copy to prevent 100g propagation
        const isSeasoning = item.product && shouldCapAsSeasoning(
          item.product.food_type,
          item.product.name,
          item.product.food_type
        );
        if (isSeasoning && quantity > DEFAULT_SEASONING_MAX_GRAMS) {
          quantity = DEFAULT_SEASONING_MAX_GRAMS;
        }
        
        return {
          user_id: user.id,
          meal_plan_id: targetPlan.id,
          product_id: item.product_id,
          meal_type: item.meal_type,
          quantity_grams: quantity,
          // Don't copy is_locked status
        };
      });

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

  // Copy all items from one day to the previous day
  const copyDayToPrevious = useMutation({
    mutationFn: async ({ sourcePlanId, sourcePlanDate }: { sourcePlanId: string; sourcePlanDate: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Find source plan items
      const sourcePlan = mealPlans.find(p => p.id === sourcePlanId);
      if (!sourcePlan || !sourcePlan.items || sourcePlan.items.length === 0) {
        throw new Error("No items to copy");
      }

      // Find previous day's plan
      const sourceIndex = weekDates.indexOf(sourcePlanDate);
      if (sourceIndex <= 0) {
        throw new Error("Cannot copy to previous day - start of week");
      }

      const prevDate = weekDates[sourceIndex - 1];
      const targetPlan = mealPlans.find(p => p.meal_date === prevDate);
      if (!targetPlan) {
        throw new Error("Previous day plan not found");
      }

      // Create copies of all items, clamping seasonings
      const newItems = sourcePlan.items.map(item => {
        let quantity = item.quantity_grams;
        
        const isSeasoning = item.product && shouldCapAsSeasoning(
          item.product.food_type,
          item.product.name,
          item.product.food_type
        );
        if (isSeasoning && quantity > DEFAULT_SEASONING_MAX_GRAMS) {
          quantity = DEFAULT_SEASONING_MAX_GRAMS;
        }
        
        return {
          user_id: user.id,
          meal_plan_id: targetPlan.id,
          product_id: item.product_id,
          meal_type: item.meal_type,
          quantity_grams: quantity,
        };
      });

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert(newItems)
        .select();
      
      if (error) throw error;
      return { count: data?.length || 0, targetDate: prevDate };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      toast.success(`Copied ${result.count} items to ${result.targetDate}`);
    },
    onError: (error) => {
      toast.error("Failed to copy: " + error.message);
    },
  });

  // Copy all items from one day to any date in the week
  const copyDayToDate = useMutation({
    mutationFn: async ({ sourcePlanId, sourcePlanDate, targetDate }: { sourcePlanId: string; sourcePlanDate: string; targetDate: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      // Validate target date
      if (!weekDates.includes(targetDate)) {
        throw new Error("Target date not in current week");
      }
      if (targetDate === sourcePlanDate) {
        throw new Error("Cannot copy to the same day");
      }
      
      // Find source plan items
      const sourcePlan = mealPlans.find(p => p.id === sourcePlanId);
      if (!sourcePlan || !sourcePlan.items || sourcePlan.items.length === 0) {
        throw new Error("No items to copy");
      }

      // Find target plan
      const targetPlan = mealPlans.find(p => p.meal_date === targetDate);
      if (!targetPlan) {
        throw new Error("Target day plan not found");
      }

      // Create copies of all items, clamping seasonings
      const newItems = sourcePlan.items.map(item => {
        let quantity = item.quantity_grams;
        
        const isSeasoning = item.product && shouldCapAsSeasoning(
          item.product.food_type,
          item.product.name,
          item.product.food_type
        );
        if (isSeasoning && quantity > DEFAULT_SEASONING_MAX_GRAMS) {
          quantity = DEFAULT_SEASONING_MAX_GRAMS;
        }
        
        return {
          user_id: user.id,
          meal_plan_id: targetPlan.id,
          product_id: item.product_id,
          meal_type: item.meal_type,
          quantity_grams: quantity,
        };
      });

      const { data, error } = await supabase
        .from("meal_plan_items")
        .insert(newItems)
        .select();
      
      if (error) throw error;
      return { count: data?.length || 0, targetDate };
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
      // Use format() instead of toISOString().split() to avoid timezone shifts
      const prevWeekDates = Array.from({ length: 9 }, (_, i) => {
        const date = addDays(weekRange.start, -9 + i);
        return format(date, "yyyy-MM-dd");
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
        .select("*, product:products(*)")
        .in("meal_plan_id", prevPlanIds);
      
      if (itemsError) throw itemsError;

      // Map previous dates to current week dates
      const dateMap = new Map(prevWeekDates.map((prev, i) => [prev, weekDates[i]]));
      const prevPlanToDate = new Map(prevPlans.map(p => [p.id, p.meal_date]));
      
      // Get current week plans
      const currentPlansByDate = new Map(mealPlans.map(p => [p.meal_date, p]));

      // Copy items, clamping seasonings (Fix B2)
      const newItems = (prevItems || []).map(item => {
        const prevDate = prevPlanToDate.get(item.meal_plan_id);
        const newDate = prevDate ? dateMap.get(prevDate) : null;
        const newPlan = newDate ? currentPlansByDate.get(newDate) : null;
        
        if (!newPlan) return null;
        
        // Clamp seasonings during copy
        let quantity = item.quantity_grams;
        const product = item.product as Product | null;
        if (product) {
          const isSeasoning = shouldCapAsSeasoning(
            product.food_type,
            product.name,
            product.food_type
          );
          if (isSeasoning && quantity > DEFAULT_SEASONING_MAX_GRAMS) {
            quantity = DEFAULT_SEASONING_MAX_GRAMS;
          }
        }
        
        return {
          user_id: user.id,
          meal_plan_id: newPlan.id,
          product_id: item.product_id,
          meal_type: item.meal_type,
          quantity_grams: quantity,
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

  // V2: Convert meal plan items to solver items
  const convertToSolverItems = useCallback((items: MealPlanItem[]): SolverItem[] => {
    return items.map(item => {
      const product = item.product;
      if (!product) {
        // Fallback for items without product data
        return {
          id: item.id,
          name: 'Unknown',
          category: 'other' as const,
          mealType: item.meal_type as SolverMealType,
          nutritionPer100g: { calories: 0, protein: 0, carbs: 0, fat: 0 },
          editableMode: item.is_locked ? 'LOCKED' : 'FREE',
          minPortionGrams: 0,
          maxPortionGrams: 500,
          portionStepGrams: 1,
          roundingRule: 'nearest_1g' as const,
          unitType: 'grams' as const,
          unitSizeGrams: null,
          eatenFactor: 1,
          seasoningRatePer100g: null,
          pairedProteinId: null,
          currentGrams: item.quantity_grams,
          countMacros: true,
        };
      }
      
      // Determine editable mode
      let editableMode: 'LOCKED' | 'BOUNDED' | 'FREE' = 'FREE';
      if (item.is_locked) {
        editableMode = 'LOCKED';
      } else if (product.product_type === 'fixed') {
        editableMode = 'LOCKED';
      } else if (product.editable_mode) {
        editableMode = product.editable_mode as 'LOCKED' | 'BOUNDED' | 'FREE';
      }
      
      return productToSolverItem(
        {
          id: item.id, // Use item.id, not product.id, for portion mapping
          name: product.name,
          calories_per_100g: product.calories_per_100g,
          protein_per_100g: product.protein_per_100g,
          carbs_per_100g: product.carbs_per_100g,
          fat_per_100g: product.fat_per_100g,
          food_type: product.food_type,
          editable_mode: editableMode,
          min_portion_grams: product.min_portion_grams,
          max_portion_grams: product.max_portion_grams,
          portion_step_grams: product.portion_step_grams,
          rounding_rule: product.rounding_rule,
          eaten_factor: product.eaten_factor,
          seasoning_rate_per_100g: product.seasoning_rate_per_100g,
          default_unit_type: product.default_unit_type,
          unit_size_g: product.unit_size_g,
          fixed_portion_grams: product.fixed_portion_grams,
        },
        item.meal_type as SolverMealType,
        item.is_locked || product.product_type === 'fixed' ? item.quantity_grams : 0
      );
    });
  }, []);

  // Generate portions for a single day using V2 engine.
  //
  // STRICT MODE: Only writes to DB when solver returns success=true
  // (P/C at or above target up to +2g, fat within -1/+2g, calories ±50 kcal).
  // On failure: returns diagnostics but does NOT overwrite saved plan.
  const recalculateDay = useMutation({
    mutationFn: async ({
      planId,
      settings,
      portioningSettings = DEFAULT_PORTIONING_SETTINGS,
      weeklyOverride,
      previousWeekOverride
    }: {
      planId: string;
      settings: NutritionSettings;
      portioningSettings?: PortioningSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
      previousWeekOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const plan = mealPlans.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      const items = plan.items || [];
      if (items.length === 0) throw new Error("No items to generate");

      const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
      const targets = getDailyTargets(dayDate, settings, weeklyOverride, previousWeekOverride);

      const solverItems = convertToSolverItems(items);
      const solverTargets: SolverTargets = {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
      };

      const result = solve(solverItems, solverTargets, {
        ...DEFAULT_SOLVER_OPTIONS,
        seasoningsCountMacros: true,
        debugMode: false,
      });

      // ==============================================================
      // STRICT MODE: On failure, return diagnostics. Do NOT write to DB.
      // ==============================================================
      if (!result.success) {
        const failedResult = result as SolverFailed;
        const failure = failedResult.failure;
        const t = failure.closestTotals;
        const d = failure.targetDelta;

        const diagnostics: string[] = [];
        if (failure.reason === 'impossible_targets') {
          diagnostics.push("Can't solve with current foods: targets are impossible with these items and constraints.");
        } else if (failure.reason === 'no_adjustable_items') {
          diagnostics.push("Can't solve: all items are fixed/locked — no adjustable portions.");
        } else {
          diagnostics.push("Can't solve: could not find portions within tolerance (P/C ≥target +2g, fat -1/+2g, cal ±50).");
        }
        diagnostics.push(
          `Closest achievable: ${t.calories}kcal, ${t.protein}g P, ${t.carbs}g C, ${t.fat}g F`
        );
        diagnostics.push(
          `Off by: P ${d.protein > 0 ? '+' : ''}${d.protein}g, C ${d.carbs > 0 ? '+' : ''}${d.carbs}g, F ${d.fat > 0 ? '+' : ''}${d.fat}g, Cal ${d.calories > 0 ? '+' : ''}${d.calories}`
        );
        if (failure.blockers.length > 0) {
          diagnostics.push(
            "Blockers: " + failure.blockers.slice(0, 3).map(b => b.detail || `${b.itemName}: ${b.constraint}`).join("; ")
          );
        }

        // Return failure WITHOUT writing anything to DB.
        return {
          success: false as const,
          updated: 0,
          warnings: diagnostics,
        };
      }

      // SUCCESS: write solver portions to DB (skip fixed/locked items — they are constants)
      let updated = 0;
      for (const item of items) {
        if (item.is_locked) continue;
        if (item.product?.product_type === "fixed") continue;

        const newGrams = result.portions.get(item.id);
        if (newGrams !== undefined && newGrams > 0) {
          const { error } = await supabase
            .from("meal_plan_items")
            .update({ quantity_grams: newGrams })
            .eq("id", item.id)
            .eq("user_id", user.id);

          if (error) throw error;
          updated++;
        }
      }

      return {
        success: true as const,
        updated,
        warnings: result.warnings ?? [],
      };
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
        setLastCalculated(new Date());
        toast.success(`Generated portions (${result.updated} items within tolerance)`);
      } else {
        // FAIL: Nothing was written to DB. Show clear error.
        toast.error(result.warnings?.[0] ?? "Can't solve with current foods.");
        if (result.warnings && result.warnings.length > 1) {
          toast.info(result.warnings.slice(1, 3).join(" | "), { duration: 8000 });
        }
      }
    },
    onError: (error) => {
      toast.error("Failed to generate: " + error.message);
    },
  });

  // Generate portions for ALL days using V2 engine.
  //
  // STRICT MODE: Only writes to DB for days where solver returns success=true.
  // Failed days are skipped (no DB write) and reported as diagnostics.
  const recalculateAll = useMutation({
    mutationFn: async ({
      settings,
      portioningSettings = DEFAULT_PORTIONING_SETTINGS,
      weeklyOverride,
      previousWeekOverride
    }: {
      settings: NutritionSettings;
      portioningSettings?: PortioningSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
      previousWeekOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      let totalUpdated = 0;
      let successCount = 0;
      let failedCount = 0;
      let attemptedDays = 0;
      const dayWarnings: Array<{ date: string; warnings: string[]; failed: boolean }> = [];

      for (const plan of mealPlans) {
        const items = plan.items || [];
        if (items.length === 0) continue;
        attemptedDays++;

        const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
        const targets = getDailyTargets(dayDate, settings, weeklyOverride, previousWeekOverride);

        const solverItems = convertToSolverItems(items);
        const solverTargets: SolverTargets = {
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat,
        };

        // Run V2 solver — count seasoning macros so UI and solver agree
        const result = solve(solverItems, solverTargets, {
          ...DEFAULT_SOLVER_OPTIONS,
          seasoningsCountMacros: true,
          debugMode: false,
        });

        // ==============================================================
        // STRICT MODE: On failure, skip DB write for this day.
        // ==============================================================
        if (!result.success) {
          failedCount++;
          const failure = (result as SolverFailed).failure;
          const t = failure.closestTotals;
          const d = failure.targetDelta;
          dayWarnings.push({
            date: plan.meal_date,
            warnings: [
              `Can't solve: P ${d.protein > 0 ? '+' : ''}${d.protein}g, ` +
              `C ${d.carbs > 0 ? '+' : ''}${d.carbs}g, ` +
              `F ${d.fat > 0 ? '+' : ''}${d.fat}g, ` +
              `Cal ${d.calories > 0 ? '+' : ''}${d.calories}`,
              `Closest: ${t.calories}kcal, ${t.protein}g P, ${t.carbs}g C, ${t.fat}g F`,
            ],
            failed: true,
          });
          continue; // SKIP DB write for failed days
        }

        // SUCCESS: write solver portions to DB (skip fixed/locked — they are constants)
        successCount++;
        for (const item of items) {
          if (item.is_locked) continue;
          if (item.product?.product_type === 'fixed') continue;

          const newGrams = result.portions.get(item.id);
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

      return {
        updated: totalUpdated,
        daysSucceeded: successCount,
        daysFailed: failedCount,
        totalDays: attemptedDays,
        dayWarnings
      };
    },
    onSuccess: (result) => {
      if (result.daysSucceeded > 0) {
        queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
        setLastCalculated(new Date());
      }

      const firstFail = result.dayWarnings?.[0];
      const failureHint = firstFail
        ? ` | ${firstFail.date}: ${firstFail.warnings[0]}`
        : "";

      if (result.totalDays === 0) {
        toast.info("No meal plans with items to generate.");
      } else if (result.daysFailed === 0) {
        toast.success(`Generated portions for all ${result.daysSucceeded} days (${result.updated} items)`);
      } else if (result.daysSucceeded > 0) {
        toast.warning(
          `Generated ${result.daysSucceeded}/${result.totalDays} days. ` +
          `${result.daysFailed} day(s) failed (not saved).` +
          failureHint
        );
      } else {
        toast.error(
          `All ${result.totalDays} days failed — no portions saved. ` +
          `Targets not achievable with current items.` +
          failureHint
        );
      }
    },
    onError: (error) => {
      toast.error("Failed to generate: " + error.message);
    },
  });

  // AI-powered portioning via Claude
  const aiPlanDay = useMutation({
    mutationFn: async ({
      planId,
      settings,
      weeklyOverride,
      previousWeekOverride
    }: {
      planId: string;
      settings: NutritionSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
      previousWeekOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const plan = mealPlans.find(p => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      const items = plan.items || [];
      if (items.length === 0) throw new Error("No items to plan");

      const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
      const targets = getDailyTargets(dayDate, settings, weeklyOverride, previousWeekOverride);

      // Build item data for AI
      const itemsPayload = items.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.product?.name || 'Unknown',
        meal_type: item.meal_type,
        is_locked: item.is_locked || item.product?.product_type === 'fixed',
        quantity_grams: item.quantity_grams,
        calories_per_100g: item.product?.calories_per_100g || 0,
        protein_per_100g: item.product?.protein_per_100g || 0,
        carbs_per_100g: item.product?.carbs_per_100g || 0,
        fat_per_100g: item.product?.fat_per_100g || 0,
        food_type: item.product?.food_type || 'other',
        min_portion_grams: item.product?.min_portion_grams || 10,
        max_portion_grams: item.product?.max_portion_grams || 500,
        product_type: item.product?.product_type || 'editable',
      }));

      const { data, error } = await supabase.functions.invoke('claude-ai', {
        body: {
          feature: 'meal_planner',
          input: {
            items: itemsPayload,
            targets: {
              calories: targets.calories,
              protein: targets.protein,
              carbs: targets.carbs,
              fat: targets.fat,
            },
          },
        },
      });

      if (error) throw error;
      
      // DEBUG: log raw AI response for verification
      console.log("AI_RESPONSE", { success: data?.success, status: data?.status, totals: data?.totals, targets: data?.targets, violations: data?.violations, portionCount: data?.portions?.length });
      
      // HARD VALIDATION GATE: If server says FAIL_CONSTRAINTS, do NOT save
      if (!data?.success || data?.status === 'FAIL_CONSTRAINTS') {
        console.log("SAVE_CALLED?", "NO — FAIL_CONSTRAINTS gate blocked save");
        const violations = data?.violations || [];
        const fixes = data?.suggested_fixes || [];
        return {
          updated: 0,
          failed: true,
          violations,
          suggested_fixes: fixes,
          totals: data?.totals,
          targets: data?.targets,
        };
      }
      
      if (!data?.portions || data.portions.length === 0) {
        throw new Error("AI returned no portions");
      }

      console.log("SAVE_CALLED?", "YES — PASS, saving", data.portions.length, "portions");
      
      // PASS: Apply validated portions to DB
      let updated = 0;
      for (const portion of data.portions) {
        const item = items.find(i => i.id === portion.id);
        if (!item) continue;
        if (item.is_locked || item.product?.product_type === 'fixed') continue;

        const { error: updateError } = await supabase
          .from("meal_plan_items")
          .update({ quantity_grams: portion.quantity_grams })
          .eq("id", portion.id)
          .eq("user_id", user.id);

        if (updateError) throw updateError;
        updated++;
      }

      return { updated, failed: false };
    },
    onSuccess: (result) => {
      if (result.failed) {
        // FAIL: No DB writes occurred. UI state is unchanged.
        toast.error("AI Plan failed — no changes were saved.", { duration: 8000 });
        if (result.suggested_fixes?.length) {
          // Show top 2 suggestions as separate toasts for readability
          for (const fix of result.suggested_fixes.slice(0, 2)) {
            toast.info(fix, { duration: 15000 });
          }
        }
        console.log("SAVE_CALLED?", "NO — FAIL_CONSTRAINTS");
        console.log("FAIL_DETAILS", {
          violations: result.violations,
          suggested_fixes: result.suggested_fixes,
          totals: result.totals,
          targets: result.targets,
        });
        // DO NOT invalidate queries — keep UI showing saved state
      } else {
        queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
        toast.success(`AI planned ${result.updated} portions`);
      }
    },
    onError: (error) => {
      toast.error("AI planning failed: " + error.message);
    },
  });

  // AI-powered portioning for ALL days in the week
  const aiPlanWeek = useMutation({
    mutationFn: async ({
      settings,
      weeklyOverride,
      previousWeekOverride
    }: {
      settings: NutritionSettings;
      weeklyOverride?: WeeklyTargetsOverride | null;
      previousWeekOverride?: WeeklyTargetsOverride | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      let totalUpdated = 0;
      let successCount = 0;
      let failedCount = 0;

      for (const plan of mealPlans) {
        const items = plan.items || [];
        if (items.length === 0) continue;

        const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
        const targets = getDailyTargets(dayDate, settings, weeklyOverride, previousWeekOverride);

        const itemsPayload = items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          name: item.product?.name || 'Unknown',
          meal_type: item.meal_type,
          is_locked: item.is_locked || item.product?.product_type === 'fixed',
          quantity_grams: item.quantity_grams,
          calories_per_100g: item.product?.calories_per_100g || 0,
          protein_per_100g: item.product?.protein_per_100g || 0,
          carbs_per_100g: item.product?.carbs_per_100g || 0,
          fat_per_100g: item.product?.fat_per_100g || 0,
          food_type: item.product?.food_type || 'other',
          min_portion_grams: item.product?.min_portion_grams || 10,
          max_portion_grams: item.product?.max_portion_grams || 500,
          product_type: item.product?.product_type || 'editable',
        }));

        try {
          const { data, error } = await supabase.functions.invoke('claude-ai', {
            body: {
              feature: 'meal_planner',
              input: {
                items: itemsPayload,
                targets: {
                  calories: targets.calories,
                  protein: targets.protein,
                  carbs: targets.carbs,
                  fat: targets.fat,
                },
              },
            },
          });

          if (error || !data?.success || data?.status === 'FAIL_CONSTRAINTS' || !data?.portions) {
            failedCount++;
            continue;
          }

          // PASS: Apply validated portions to DB
          for (const portion of data.portions) {
            const item = items.find(i => i.id === portion.id);
            if (!item) continue;
            if (item.is_locked || item.product?.product_type === 'fixed') continue;

            const { error: updateError } = await supabase
              .from("meal_plan_items")
              .update({ quantity_grams: portion.quantity_grams })
              .eq("id", portion.id)
              .eq("user_id", user.id);

            if (!updateError) totalUpdated++;
          }
          successCount++;
        } catch {
          failedCount++;
        }
      }

      return { updated: totalUpdated, daysSucceeded: successCount, daysFailed: failedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      if (result.daysFailed === 0) {
        toast.success(`AI planned ${result.daysSucceeded} days (${result.updated} items)`);
      } else if (result.daysSucceeded > 0) {
        toast.warning(`AI planned ${result.daysSucceeded} days, ${result.daysFailed} failed`);
      } else {
        toast.error("AI planning failed for all days");
      }
    },
    onError: (error) => {
      toast.error("AI week planning failed: " + error.message);
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
    copyDayToPrevious,
    copyDayToDate,
    clearDay,
    clearWeek,
    recalculateDay,
    recalculateAll,
    aiPlanDay,
    aiPlanWeek,
    lastCalculated,
  };
}
