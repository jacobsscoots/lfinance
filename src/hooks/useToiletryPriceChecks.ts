import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

export interface PriceCheckResult {
  retailer: string;
  price: number;
  offer_price?: number;
  offer_label?: string;
  product_url: string;
  product_name: string;
  dispatch_days?: number;
  delivery_days?: number;
  total_lead_time?: number;
  in_stock: boolean;
}

export interface SavedPriceCheck {
  id: string;
  user_id: string;
  toiletry_item_id: string;
  retailer: string;
  price: number;
  offer_price: number | null;
  offer_label: string | null;
  product_url: string | null;
  product_name: string | null;
  dispatch_days: number | null;
  delivery_days: number | null;
  total_lead_time: number | null;
  in_stock: boolean;
  checked_at: string;
  created_at: string;
}

export function useToiletryPriceChecks(itemId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch saved price checks for an item
  const { data: savedChecks = [], isLoading: isLoadingSaved } = useQuery({
    queryKey: ["toiletry-price-checks", itemId],
    queryFn: async () => {
      if (!itemId) return [];
      
      const { data, error } = await supabase
        .from("toiletry_price_checks")
        .select("*")
        .eq("toiletry_item_id", itemId)
        .order("checked_at", { ascending: false });

      if (error) throw error;
      return data as SavedPriceCheck[];
    },
    enabled: !!itemId,
  });

  // Get the most recent check time
  const lastCheckedAt = savedChecks.length > 0 ? savedChecks[0].checked_at : null;

  return {
    savedChecks,
    isLoadingSaved,
    lastCheckedAt,
  };
}

export function useSearchPrices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSearching, setIsSearching] = useState(false);

  const searchPrices = async (item: ToiletryItem): Promise<PriceCheckResult[]> => {
    setIsSearching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("search-toiletry-prices", {
        body: {
          productName: item.name,
          brand: item.brand,
          size: item.total_size,
          sizeUnit: item.size_unit,
        },
      });

      if (error) {
        console.error("Search error:", error);
        throw new Error(error.message || "Failed to search prices");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Failed to search prices");
      }

      return data.data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to search prices";
      toast({
        title: "Search failed",
        description: message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const savePriceChecks = useMutation({
    mutationFn: async ({ 
      itemId, 
      results 
    }: { 
      itemId: string; 
      results: PriceCheckResult[] 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Delete old checks for this item
      await supabase
        .from("toiletry_price_checks")
        .delete()
        .eq("toiletry_item_id", itemId);

      // Insert new checks
      const inserts = results.map(r => ({
        user_id: user.id,
        toiletry_item_id: itemId,
        retailer: r.retailer,
        price: r.price,
        offer_price: r.offer_price || null,
        offer_label: r.offer_label || null,
        product_url: r.product_url,
        product_name: r.product_name,
        dispatch_days: r.dispatch_days || null,
        delivery_days: r.delivery_days || null,
        in_stock: r.in_stock,
      }));

      if (inserts.length === 0) return;

      const { error } = await supabase
        .from("toiletry_price_checks")
        .insert(inserts);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ["toiletry-price-checks", variables.itemId] 
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to save price checks",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    },
  });

  return {
    searchPrices,
    savePriceChecks,
    isSearching,
  };
}
