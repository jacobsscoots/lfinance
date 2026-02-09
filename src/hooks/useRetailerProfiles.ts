import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";

export interface RetailerProfile {
  id: string;
  user_id: string;
  retailer_name: string;
  dispatch_days_min: number;
  dispatch_days_max: number;
  delivery_days_min: number;
  delivery_days_max: number;
  dispatches_weekends: boolean;
  delivers_weekends: boolean;
  cutoff_time: string | null;
  created_at: string;
  updated_at: string;
}

const DEFAULT_PROFILES = [
  { retailer_name: "Amazon", dispatch_days_min: 0, dispatch_days_max: 0, delivery_days_min: 1, delivery_days_max: 2, dispatches_weekends: true, delivers_weekends: true },
  { retailer_name: "Boots", dispatch_days_min: 0, dispatch_days_max: 1, delivery_days_min: 2, delivery_days_max: 5, dispatches_weekends: false, delivers_weekends: false },
  { retailer_name: "Superdrug", dispatch_days_min: 0, dispatch_days_max: 1, delivery_days_min: 2, delivery_days_max: 5, dispatches_weekends: false, delivers_weekends: false },
  { retailer_name: "Savers", dispatch_days_min: 1, dispatch_days_max: 2, delivery_days_min: 3, delivery_days_max: 7, dispatches_weekends: false, delivers_weekends: false },
  { retailer_name: "Other", dispatch_days_min: 1, dispatch_days_max: 2, delivery_days_min: 3, delivery_days_max: 7, dispatches_weekends: false, delivers_weekends: false },
];

export const RETAILER_OPTIONS = [
  "Amazon", "Boots", "Superdrug", "Savers", "Other",
];

export function useRetailerProfiles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  const profilesQuery = useQuery({
    queryKey: ["retailer-profiles", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("retailer_shipping_profiles")
        .select("*")
        .order("retailer_name");
      if (error) throw error;
      return data as RetailerProfile[];
    },
    enabled: !!user?.id,
  });

  // Auto-seed defaults if none exist
  useEffect(() => {
    if (!user?.id || seeded.current || profilesQuery.isLoading) return;
    if (profilesQuery.data && profilesQuery.data.length === 0) {
      seeded.current = true;
      const rows = DEFAULT_PROFILES.map((p) => ({ ...p, user_id: user.id }));
      supabase
        .from("retailer_shipping_profiles")
        .insert(rows as any)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["retailer-profiles"] });
        });
    }
  }, [user?.id, profilesQuery.data, profilesQuery.isLoading, queryClient]);

  const upsertProfile = useMutation({
    mutationFn: async (profile: Partial<RetailerProfile> & { retailer_name: string }) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("retailer_shipping_profiles")
        .upsert(
          { ...profile, user_id: user.id, updated_at: new Date().toISOString() } as any,
          { onConflict: "user_id,retailer_name" }
        )
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-profiles"] });
      toast({ title: "Profile saved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("retailer_shipping_profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["retailer-profiles"] });
      toast({ title: "Profile deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return {
    profiles: profilesQuery.data ?? [],
    isLoading: profilesQuery.isLoading,
    upsertProfile,
    deleteProfile,
    getProfileForRetailer: (retailerName: string) =>
      (profilesQuery.data ?? []).find(
        (p) => p.retailer_name.toLowerCase() === retailerName?.toLowerCase()
      ) ?? (profilesQuery.data ?? []).find((p) => p.retailer_name === "Other") ?? null,
  };
}
