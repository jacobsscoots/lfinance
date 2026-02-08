import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface CheaperBillsSettings {
  id: string;
  user_id: string;
  savings_threshold: number;
  preferred_contract_type: string;
  risk_preference: string;
  scan_frequency: string;
  email_notifications: boolean;
  in_app_notifications: boolean;
  postcode: string | null;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_SETTINGS: Partial<CheaperBillsSettings> = {
  savings_threshold: 50,
  preferred_contract_type: "any",
  risk_preference: "balanced",
  scan_frequency: "monthly",
  email_notifications: true,
  in_app_notifications: true,
};

export function useCheaperBillsSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["cheaper-bills-settings", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("cheaper_bills_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as CheaperBillsSettings | null;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<CheaperBillsSettings>) => {
      if (!user) throw new Error("Not authenticated");

      const { data: updated, error } = await supabase
        .from("cheaper_bills_settings")
        .upsert(
          {
            user_id: user.id,
            ...DEFAULT_SETTINGS,
            ...settings,
            ...data,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (error) throw error;
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cheaper-bills-settings"] });
      toast.success("Settings saved");
    },
    onError: (error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });

  // Return merged settings with defaults
  const mergedSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
  } as CheaperBillsSettings;

  return {
    settings: mergedSettings,
    isLoading,
    error,
    updateSettings: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
