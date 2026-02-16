import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TransactionTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TAGS = [
  { name: "Moved to grocery pot", color: "#22c55e" },
  { name: "Savings transfer", color: "#3b82f6" },
  { name: "Bill payment", color: "#f59e0b" },
  { name: "Discretionary spend", color: "#8b5cf6" },
];

export function useTransactionTags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const tagsQuery = useQuery({
    queryKey: ["transaction-tags", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transaction_tags" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as TransactionTag[];
    },
    enabled: !!user,
  });

  // Seed defaults if none exist
  const seedDefaults = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const inserts = DEFAULT_TAGS.map(t => ({
        user_id: user.id,
        name: t.name,
        color: t.color,
      }));
      const { error } = await supabase
        .from("transaction_tags" as any)
        .upsert(inserts as any, { onConflict: "user_id,name" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tags"] });
    },
  });

  const createTag = useMutation({
    mutationFn: async (input: { name: string; color: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("transaction_tags" as any)
        .insert({ user_id: user.id, name: input.name, color: input.color } as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TransactionTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tags"] });
      toast.success("Tag created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTag = useMutation({
    mutationFn: async (input: { id: string; name: string; color: string }) => {
      const { error } = await supabase
        .from("transaction_tags" as any)
        .update({ name: input.name, color: input.color } as any)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tags"] });
      toast.success("Tag updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTag = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("transaction_tags" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tags"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-tag-assignments"] });
      toast.success("Tag deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return {
    tags: tagsQuery.data || [],
    isLoading: tagsQuery.isLoading,
    createTag,
    updateTag,
    deleteTag,
    seedDefaults,
  };
}

export interface TagAssignment {
  id: string;
  transaction_id: string;
  tag_id: string;
  user_id: string;
}

export function useTagAssignments(transactionIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transaction-tag-assignments", user?.id, transactionIds],
    queryFn: async () => {
      if (!user || transactionIds.length === 0) return [];
      const { data, error } = await supabase
        .from("transaction_tag_assignments" as any)
        .select("*")
        .eq("user_id", user.id)
        .in("transaction_id", transactionIds);
      if (error) throw error;
      return (data || []) as unknown as TagAssignment[];
    },
    enabled: !!user && transactionIds.length > 0,
  });

  const assign = useMutation({
    mutationFn: async (input: { transactionId: string; tagId: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("transaction_tag_assignments" as any)
        .insert({
          transaction_id: input.transactionId,
          tag_id: input.tagId,
          user_id: user.id,
        } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tag-assignments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const unassign = useMutation({
    mutationFn: async (input: { transactionId: string; tagId: string }) => {
      const { error } = await supabase
        .from("transaction_tag_assignments" as any)
        .delete()
        .eq("transaction_id", input.transactionId)
        .eq("tag_id", input.tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-tag-assignments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build a map: transactionId -> tagId[]
  const assignmentMap = new Map<string, string[]>();
  (query.data || []).forEach(a => {
    const existing = assignmentMap.get(a.transaction_id) || [];
    existing.push(a.tag_id);
    assignmentMap.set(a.transaction_id, existing);
  });

  return {
    assignments: query.data || [],
    assignmentMap,
    assign,
    unassign,
    isLoading: query.isLoading,
  };
}
