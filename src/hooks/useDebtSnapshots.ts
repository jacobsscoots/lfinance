import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type SnapshotSource = 'manual' | 'statement' | 'import';

export interface DebtBalanceSnapshot {
  id: string;
  user_id: string;
  debt_id: string;
  snapshot_date: string;
  balance: number;
  source: SnapshotSource;
  notes: string | null;
  created_at: string;
}

export interface SnapshotInsert {
  debt_id: string;
  snapshot_date: string;
  balance: number;
  source?: SnapshotSource;
  notes?: string | null;
}

export interface SnapshotUpdate extends Partial<SnapshotInsert> {
  id: string;
}

export function useDebtSnapshots(debtId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const snapshotsQuery = useQuery({
    queryKey: ["debt-snapshots", user?.id, debtId],
    queryFn: async () => {
      if (!user?.id) return [];
      
      let query = supabase
        .from("debt_balance_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: false });
      
      if (debtId) {
        query = query.eq("debt_id", debtId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as DebtBalanceSnapshot[];
    },
    enabled: !!user?.id,
  });

  const createSnapshot = useMutation({
    mutationFn: async (snapshot: SnapshotInsert) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("debt_balance_snapshots")
        .insert({ ...snapshot, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-snapshots"] });
      toast.success("Balance snapshot saved");
    },
    onError: (error) => {
      toast.error("Failed to save snapshot: " + error.message);
    },
  });

  const updateSnapshot = useMutation({
    mutationFn: async ({ id, ...updates }: SnapshotUpdate) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("debt_balance_snapshots")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-snapshots"] });
      toast.success("Snapshot updated");
    },
    onError: (error) => {
      toast.error("Failed to update snapshot: " + error.message);
    },
  });

  const deleteSnapshot = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("debt_balance_snapshots")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debt-snapshots"] });
      toast.success("Snapshot deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete snapshot: " + error.message);
    },
  });

  return {
    snapshots: snapshotsQuery.data ?? [],
    isLoading: snapshotsQuery.isLoading,
    error: snapshotsQuery.error,
    createSnapshot,
    updateSnapshot,
    deleteSnapshot,
  };
}
