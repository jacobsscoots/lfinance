import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Deal {
  id: string;
  user_id: string;
  source_id: string | null;
  source_name: string;
  title: string;
  price: number;
  old_price: number | null;
  discount_percent: number | null;
  currency: string;
  url: string;
  image_url: string | null;
  store: string | null;
  category: string | null;
  description_snippet: string | null;
  hash: string;
  first_seen_at: string;
  last_seen_at: string;
  is_new: boolean;
  price_dropped: boolean;
  created_at: string;
  updated_at: string;
}

export interface DealsFilter {
  search?: string;
  sourceId?: string;
  isNew?: boolean;
  minDiscount?: number;
  sortBy?: "newest" | "discount" | "price_low" | "price_high";
}

export function useDeals(filter: DealsFilter = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: deals = [], isLoading, error } = useQuery({
    queryKey: ["deals", user?.id, filter],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("deals")
        .select("*")
        .eq("user_id", user.id);

      if (filter.sourceId) {
        query = query.eq("source_id", filter.sourceId);
      }

      if (filter.isNew) {
        query = query.eq("is_new", true);
      }

      if (filter.minDiscount) {
        query = query.gte("discount_percent", filter.minDiscount);
      }

      if (filter.search) {
        query = query.ilike("title", `%${filter.search}%`);
      }

      switch (filter.sortBy) {
        case "discount":
          query = query.order("discount_percent", { ascending: false, nullsFirst: false });
          break;
        case "price_low":
          query = query.order("price", { ascending: true });
          break;
        case "price_high":
          query = query.order("price", { ascending: false });
          break;
        case "newest":
        default:
          query = query.order("first_seen_at", { ascending: false });
      }

      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data as Deal[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal removed");
    },
    onError: (error) => toast.error(`Failed to delete: ${error.message}`),
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deals").update({ is_new: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
    },
  });

  return {
    deals,
    isLoading,
    error,
    deleteDeal: deleteMutation.mutate,
    markAsRead: markAsReadMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}
