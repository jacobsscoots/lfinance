import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { ToiletryItem } from "@/lib/toiletryCalculations";

type ToiletryInsert = Omit<ToiletryItem, "id" | "created_at" | "updated_at">;
type ToiletryUpdate = Partial<Omit<ToiletryItem, "id" | "user_id" | "created_at" | "updated_at">>;

export function useToiletries() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: toiletries = [], isLoading, error } = useQuery({
    queryKey: ["toiletries", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("toiletry_items")
        .select("*")
        .order("name", { ascending: true });
      
      if (error) throw error;
      return data as ToiletryItem[];
    },
    enabled: !!user?.id,
  });

  const createToiletry = useMutation({
    mutationFn: async (item: Omit<ToiletryInsert, "user_id">) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const { data, error } = await supabase
        .from("toiletry_items")
        .insert({ ...item, user_id: user.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      toast({ title: "Item added", description: "Toiletry item has been added." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateToiletry = useMutation({
    mutationFn: async ({ id, ...updates }: ToiletryUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("toiletry_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      toast({ title: "Item updated", description: "Toiletry item has been updated." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const deleteToiletry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("toiletry_items")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      toast({ title: "Item deleted", description: "Toiletry item has been deleted." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const restockToiletry = useMutation({
    mutationFn: async ({ id, totalSize }: { id: string; totalSize: number }) => {
      const { data, error } = await supabase
        .from("toiletry_items")
        .update({ 
          current_remaining: totalSize,
          last_restocked_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      toast({ title: "Item restocked", description: "Item has been marked as fully restocked." });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const logWeight = useMutation({
    mutationFn: async ({ 
      id, 
      weight, 
      readingType 
    }: { 
      id: string; 
      weight: number; 
      readingType: "full" | "regular" | "empty";
    }) => {
      const updates: Record<string, unknown> = {
        current_weight_grams: weight,
        last_weighed_at: new Date().toISOString(),
      };

      if (readingType === "full") {
        updates.full_weight_grams = weight;
        updates.opened_at = new Date().toISOString().split('T')[0];
      } else if (readingType === "empty") {
        updates.empty_weight_grams = weight;
        updates.finished_at = new Date().toISOString().split('T')[0];
      }

      const { data, error } = await supabase
        .from("toiletry_items")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["toiletries"] });
      const message = variables.readingType === "full" 
        ? "Full weight recorded. You can now track usage over time."
        : variables.readingType === "empty"
        ? "Item marked as finished."
        : "Weight recorded.";
      toast({ title: "Weight logged", description: message });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  return {
    toiletries,
    isLoading,
    error,
    createToiletry,
    updateToiletry,
    deleteToiletry,
    restockToiletry,
    logWeight,
  };
}
