import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { BlackoutRange } from "@/lib/mealPlannerWeek";

export interface BlackoutFormData {
  start_date: string;
  end_date: string;
  reason?: string | null;
}

export function useMealPlanBlackouts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: blackouts = [], isLoading, error } = useQuery({
    queryKey: ["meal-plan-blackouts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("meal_plan_blackout_ranges")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: true });
      
      if (error) throw error;
      return data as BlackoutRange[];
    },
    enabled: !!user,
  });

  const createBlackout = useMutation({
    mutationFn: async (formData: BlackoutFormData) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("meal_plan_blackout_ranges")
        .insert({
          ...formData,
          user_id: user.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan-blackouts"] });
      toast.success("Holiday/break added");
    },
    onError: (error) => {
      toast.error("Failed to add holiday: " + error.message);
    },
  });

  const updateBlackout = useMutation({
    mutationFn: async ({ id, ...formData }: BlackoutFormData & { id: string }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("meal_plan_blackout_ranges")
        .update(formData)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan-blackouts"] });
      toast.success("Holiday/break updated");
    },
    onError: (error) => {
      toast.error("Failed to update: " + error.message);
    },
  });

  const deleteBlackout = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const { error } = await supabase
        .from("meal_plan_blackout_ranges")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meal-plan-blackouts"] });
      toast.success("Holiday/break removed");
    },
    onError: (error) => {
      toast.error("Failed to remove: " + error.message);
    },
  });

  return {
    blackouts,
    isLoading,
    error,
    createBlackout,
    updateBlackout,
    deleteBlackout,
  };
}
