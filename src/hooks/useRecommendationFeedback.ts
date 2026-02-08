import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface RecommendationFeedback {
  id: string;
  user_id: string;
  recommendation_key: string;
  status: 'already_do' | 'not_relevant' | 'dismissed' | 'helpful';
  created_at: string;
}

export const RECOMMENDATION_LABELS: Record<string, string> = {
  eco_dishwasher: 'Use dishwasher eco mode',
  eco_washer: 'Use washing machine eco mode',
  low_temp_washing: 'Wash at 30°C',
  reduce_tumble_dryer: 'Reduce tumble dryer use',
  batch_cooking: 'Batch cook meals',
  airfryer_microwave: 'Use air fryer/microwave instead of oven',
  reduce_shower_time: 'Shorter showers',
  lower_thermostat: 'Lower thermostat by 1°C',
  smart_thermostat: 'Get a smart thermostat',
  standby_loads: 'Turn off standby devices',
  led_bulbs: 'Switch to LED bulbs',
  time_of_use: 'Use time-of-use tariff',
  economy7: 'Switch to Economy 7',
  off_peak_appliances: 'Run appliances off-peak',
  draught_proofing: 'Draught-proof your home',
  hot_water_timer: 'Set hot water timer',
  solar_panels: 'Consider solar panels',
  switch_tariff: 'Switch energy provider',
};

export function useRecommendationFeedback() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: feedback = [], isLoading, error } = useQuery({
    queryKey: ["recommendation-feedback", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("energy_recommendation_feedback")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return data as RecommendationFeedback[];
    },
    enabled: !!user,
  });

  const setFeedbackMutation = useMutation({
    mutationFn: async ({ 
      recommendation_key, 
      status 
    }: { 
      recommendation_key: string; 
      status: RecommendationFeedback['status'];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("energy_recommendation_feedback")
        .upsert(
          {
            user_id: user.id,
            recommendation_key,
            status,
          },
          { onConflict: "user_id,recommendation_key" }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendation-feedback"] });
    },
    onError: (error) => {
      toast.error(`Failed to save feedback: ${error.message}`);
    },
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: async (recommendation_key: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("energy_recommendation_feedback")
        .delete()
        .eq("user_id", user.id)
        .eq("recommendation_key", recommendation_key);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendation-feedback"] });
    },
    onError: (error) => {
      toast.error(`Failed to remove feedback: ${error.message}`);
    },
  });

  const alreadyDoing = feedback.filter(f => f.status === 'already_do').map(f => f.recommendation_key);
  const notRelevant = feedback.filter(f => f.status === 'not_relevant').map(f => f.recommendation_key);
  const dismissed = feedback.filter(f => f.status === 'dismissed').map(f => f.recommendation_key);
  const helpful = feedback.filter(f => f.status === 'helpful').map(f => f.recommendation_key);

  return {
    feedback,
    alreadyDoing,
    notRelevant,
    dismissed,
    helpful,
    isLoading,
    error,
    setFeedback: setFeedbackMutation.mutate,
    removeFeedback: deleteFeedbackMutation.mutate,
    isUpdating: setFeedbackMutation.isPending,
  };
}
