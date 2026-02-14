import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface CellOverride {
  id: string;
  user_id: string;
  year: number;
  month: number;
  row_key: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export function useYearlyCellOverrides(year: number) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ["yearly-cell-overrides", year, user?.id];

  const { data: cellOverrides = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("yearly_planner_cell_overrides")
        .select("*")
        .eq("user_id", user.id)
        .eq("year", year);
      if (error) throw error;
      return data as CellOverride[];
    },
    enabled: !!user,
  });

  // Build a lookup map: `${rowKey}:${month}` -> amount
  const overrideMap = new Map<string, number>();
  cellOverrides.forEach(o => {
    overrideMap.set(`${o.row_key}:${o.month}`, o.amount);
  });

  const getOverride = (rowKey: string, month: number): number | undefined => {
    return overrideMap.get(`${rowKey}:${month}`);
  };

  const hasOverride = (rowKey: string, month: number): boolean => {
    return overrideMap.has(`${rowKey}:${month}`);
  };

  const upsertOverride = useMutation({
    mutationFn: async (data: { month: number; rowKey: string; amount: number }) => {
      if (!user) throw new Error("Not authenticated");
      // Check if override exists
      const existing = cellOverrides.find(
        o => o.month === data.month && o.row_key === data.rowKey
      );
      if (existing) {
        const { error } = await supabase
          .from("yearly_planner_cell_overrides")
          .update({ amount: data.amount, updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("yearly_planner_cell_overrides")
          .insert({
            user_id: user.id,
            year,
            month: data.month,
            row_key: data.rowKey,
            amount: data.amount,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeOverride = useMutation({
    mutationFn: async (data: { month: number; rowKey: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("yearly_planner_cell_overrides")
        .delete()
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", data.month)
        .eq("row_key", data.rowKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    cellOverrides,
    overrideMap,
    getOverride,
    hasOverride,
    upsertOverride: upsertOverride.mutate,
    removeOverride: removeOverride.mutate,
    isUpserting: upsertOverride.isPending,
  };
}
