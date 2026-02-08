import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { addDays, parse } from "date-fns";
import { Product, ProductType } from "./useProducts";
import { NutritionSettings } from "./useNutritionSettings";
import { getDailyTargets, WeeklyTargetsOverride } from "@/lib/dailyTargets";
// Legacy import for fallback (deprecated)
import { PortioningSettings, DEFAULT_PORTIONING_SETTINGS } from "@/lib/autoPortioning";
// V2 portioning engine (new)
import { solve, productToSolverItem } from "@/lib/portioningEngine";
import { SolverItem, SolverTargets, DEFAULT_SOLVER_OPTIONS, MealType as SolverMealType, SolverFailed } from "@/lib/portioningTypes";

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

  // Generate portions for a single day using V2 engine
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
      
      // Parse as local date to avoid UTC-shift target mismatches.
      const dayDate = parse(plan.meal_date, "yyyy-MM-dd", new Date());
      const targets = getDailyTargets(dayDate, settings, weeklyOverride);

      // Convert items to V2 solver items
      const solverItems = convertToSolverItems(items);
      
      // V2 solver targets
      const solverTargets: SolverTargets = {
        calories: targets.calories,
        protein: targets.protein,
        carbs: targets.carbs,
        fat: targets.fat,
      };
      
      // Run V2 solver
      const result = solve(solverItems, solverTargets, {
        ...DEFAULT_SOLVER_OPTIONS,
        seasoningsCountMacros: false,
        debugMode: false,
      });

      if (!result.success) {
        const failedResult = result as SolverFailed;
        const failure = failedResult.failure;
        const blockerDetails = failure.blockers.slice(0, 2).map(b => b.detail || `${b.itemName}: ${b.constraint}`);
        return { 
          success: false as const, 
          updated: 0, 
          warnings: [
            `${failure.reason.replace(/_/g, ' ')}: ${blockerDetails.join('; ')}`,
            `Closest: ${failure.closestTotals.calories}kcal, ${failure.closestTotals.protein}g P`,
          ]
        };
      }
      
      let updated = 0;
      for (const item of items) {
        if (item.is_locked) continue;
        if (item.product?.product_type === "fixed") continue;
        
        const newGrams = result.portions.get(item.id);
        
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
        // Use unified getDailyTargets for single source of truth
        const targets = getDailyTargets(dayDate, settings, weeklyOverride);
        
        // Convert to V2 solver items
        const solverItems = convertToSolverItems(items);
        
        // V2 solver targets
        const solverTargets: SolverTargets = {
          calories: targets.calories,
          protein: targets.protein,
          carbs: targets.carbs,
          fat: targets.fat,
        };
        
        // Run V2 solver
        const result = solve(solverItems, solverTargets, {
          ...DEFAULT_SOLVER_OPTIONS,
          seasoningsCountMacros: false,
          debugMode: false,
        });

        if (result.success) {
          // Debug: Log solver outcome
          console.log(`[Solver V2] ${plan.meal_date}: success=true`, {
            totals: result.totals,
            targets: solverTargets,
            iterations: result.iterationsRun,
          });
          
          successCount++;
          
          // Persist portions to DB
          for (const item of items) {
            if (item.is_locked) continue;
            if (item.product?.product_type === 'fixed') continue;

            const newGrams = result.portions.get(item.id);
            if (newGrams !== undefined) {
              const { error } = await supabase
                .from("meal_plan_items")
                .update({ quantity_grams: newGrams })
                .eq("id", item.id)
                .eq("user_id", user.id);

              if (error) throw error;
              totalUpdated++;
            }
          }
        } else {
          // Debug: Log solver outcome - cast to SolverFailed for type safety
          const failedResult = result as SolverFailed;
          const failure = failedResult.failure;
          console.log(`[Solver V2] ${plan.meal_date}: success=false`, {
            totals: failure.closestTotals,
            targets: solverTargets,
            iterations: failure.iterationsRun,
            reason: failure.reason,
          });
          
          failedCount++;
          const blockerDetails = failure.blockers.slice(0, 2).map(b => b.detail || `${b.itemName}: ${b.constraint}`);
          dayWarnings.push({
            date: plan.meal_date,
            warnings: [
              `${failure.reason.replace(/_/g, ' ')}: ${blockerDetails.join('; ')}`,
              `Closest: ${failure.closestTotals.calories}kcal, ${failure.closestTotals.protein}g P`,
            ],
            failed: true,
          });
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
      queryClient.invalidateQueries({ queryKey: ["meal-plans"] });
      setLastCalculated(new Date());

      const firstFail = result.dayWarnings?.[0];
      const failureHint = firstFail ? ` ${firstFail.date}: ${firstFail.warnings[0]}` : "";

      // Provide clear feedback based on success rate
      if (result.totalDays === 0) {
        toast.info("No meal plans with items to generate.");
      } else if (result.daysFailed === 0) {
        // All solved perfectly
        toast.success(`Generated portions for all ${result.daysSucceeded} days (${result.updated} items)`);
      } else if (result.daysSucceeded > 0) {
        // Some solved, some failed
        toast.warning(
          `Generated ${result.daysSucceeded}/${result.totalDays} days (${result.updated} items). ` +
          `${result.daysFailed} day(s) could not be solved.` +
          failureHint
        );
      } else {
        // All failed
        toast.error(
          `No days could be solved. Your macro targets may not be achievable with the selected items.` +
          failureHint
        );
      }
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
