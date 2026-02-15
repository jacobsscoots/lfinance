import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { format } from "date-fns";

export function useShopListCollected(weekStart: Date) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const weekKey = format(weekStart, "yyyy-MM-dd");

  const { data: collectedIds = new Set<string>(), isLoading } = useQuery({
    queryKey: ["shop-list-collected", user?.id, weekKey],
    queryFn: async () => {
      if (!user) return new Set<string>();
      const { data, error } = await supabase
        .from("shop_list_collected")
        .select("product_id")
        .eq("user_id", user.id)
        .eq("week_start", weekKey);
      if (error) throw error;
      return new Set(data.map((r: { product_id: string }) => r.product_id));
    },
    enabled: !!user,
  });

  const toggleCollected = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error("Not authenticated");
      const isCollected = collectedIds.has(productId);
      if (isCollected) {
        const { error } = await supabase
          .from("shop_list_collected")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .eq("week_start", weekKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("shop_list_collected")
          .insert({ user_id: user.id, product_id: productId, week_start: weekKey });
        if (error) throw error;
      }
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ["shop-list-collected", user?.id, weekKey] });
      const prev = queryClient.getQueryData<Set<string>>(["shop-list-collected", user?.id, weekKey]);
      queryClient.setQueryData<Set<string>>(["shop-list-collected", user?.id, weekKey], (old) => {
        const next = new Set(old);
        if (next.has(productId)) next.delete(productId);
        else next.add(productId);
        return next;
      });
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["shop-list-collected", user?.id, weekKey], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-list-collected", user?.id, weekKey] });
    },
  });

  const resetAll = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("shop_list_collected")
        .delete()
        .eq("user_id", user.id)
        .eq("week_start", weekKey);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-list-collected", user?.id, weekKey] });
    },
  });

  return { collectedIds, isLoading, toggleCollected, resetAll };
}
