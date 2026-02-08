import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type PayoffStrategy = 'avalanche' | 'snowball';

export interface DebtSettings {
  id: string;
  user_id: string;
  monthly_budget: number | null;
  preferred_strategy: PayoffStrategy;
  reminder_days_before: number;
  no_payment_days_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface DebtSettingsUpdate {
  monthly_budget?: number | null;
  preferred_strategy?: PayoffStrategy;
  reminder_days_before?: number;
  no_payment_days_threshold?: number;
}

const DEFAULT_SETTINGS: Omit<DebtSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  monthly_budget: null,
  preferred_strategy: 'avalanche',
  reminder_days_before: 3,
  no_payment_days_threshold: 45,
};

export function useDebtSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["debt-settings", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from("debt_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as DebtSettings | null;
    },
    enabled: !!user?.id,
  });

  const upsertSettings = useMutation({
    mutationFn: async (updates: DebtSettingsUpdate) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_settings")
        .upsert({ 
          user_id: user.id,
          ...DEFAULT_SETTINGS,
          ...settingsQuery.data,
          ...updates,
        }, { 
          onConflict: "user_id" 
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-settings"] });
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error("Failed to save settings: " + error.message);
    },
  });

  // Return settings with defaults merged
  const settings: DebtSettings | null = settingsQuery.data
    ? settingsQuery.data
    : user?.id
    ? {
        id: '',
        user_id: user.id,
        ...DEFAULT_SETTINGS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    : null;

  return {
    settings,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    upsertSettings,
  };
}
