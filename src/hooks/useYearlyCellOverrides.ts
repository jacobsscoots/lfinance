import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useCallback } from "react";

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

  // Build a stable lookup map
  const overrideMap = useMemo(() => {
    const m = new Map<string, number>();
    cellOverrides.forEach(o => {
      m.set(`${o.row_key}:${o.month}`, o.amount);
    });
    return m;
  }, [cellOverrides]);

  const getOverride = useCallback((rowKey: string, month: number): number | undefined => {
    return overrideMap.get(`${rowKey}:${month}`);
  }, [overrideMap]);

  const hasOverride = useCallback((rowKey: string, month: number): boolean => {
    return overrideMap.has(`${rowKey}:${month}`);
  }, [overrideMap]);

  const upsertOverride = useMutation({
    mutationFn: async (data: { month: number; rowKey: string; amount: number }) => {
      if (!user) throw new Error("Not authenticated");
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
    // Optimistic update so totals recalculate immediately
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CellOverride[]>(queryKey);
      queryClient.setQueryData<CellOverride[]>(queryKey, (old = []) => {
        const idx = old.findIndex(o => o.month === data.month && o.row_key === data.rowKey);
        if (idx >= 0) {
          const updated = [...old];
          updated[idx] = { ...updated[idx], amount: data.amount };
          return updated;
        }
        return [...old, {
          id: `temp-${Date.now()}`,
          user_id: "",
          year,
          month: data.month,
          row_key: data.rowKey,
          amount: data.amount,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
      });
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
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
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CellOverride[]>(queryKey);
      queryClient.setQueryData<CellOverride[]>(queryKey, (old = []) =>
        old.filter(o => !(o.month === data.month && o.row_key === data.rowKey))
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
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
