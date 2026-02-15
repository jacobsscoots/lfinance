import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useEasySaverBalance() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: cardBalance = 0, isLoading } = useQuery({
    queryKey: ["easysaver-balance", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from("easysaver_balance")
        .select("card_balance")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.card_balance) : 0;
    },
    enabled: !!user,
  });

  const updateBalance = useMutation({
    mutationFn: async (newBalance: number) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("easysaver_balance")
        .upsert(
          { user_id: user.id, card_balance: newBalance, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["easysaver-balance", user?.id] });
    },
  });

  return { cardBalance, isLoading, updateBalance };
}
