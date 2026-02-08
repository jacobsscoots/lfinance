import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface ServicePayment {
  id: string;
  user_id: string;
  tracked_service_id: string;
  transaction_id: string | null;
  payment_date: string;
  amount: number;
  created_at: string;
  transaction?: {
    id: string;
    description: string;
    merchant: string | null;
  } | null;
}

export interface CreateServicePaymentData {
  tracked_service_id: string;
  transaction_id: string;
  payment_date: string;
  amount: number;
}

export function useServicePayments(trackedServiceId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ["service-payments", user?.id, trackedServiceId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("service_payments")
        .select(`
          *,
          transaction:transactions(id, description, merchant)
        `)
        .eq("user_id", user.id)
        .order("payment_date", { ascending: false });

      if (trackedServiceId) {
        query = query.eq("tracked_service_id", trackedServiceId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as ServicePayment[];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateServicePaymentData) => {
      if (!user) throw new Error("Not authenticated");

      const { data: payment, error } = await supabase
        .from("service_payments")
        .insert({
          user_id: user.id,
          ...data,
        })
        .select()
        .single();

      if (error) throw error;
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
      toast.success("Transaction linked to service");
    },
    onError: (error) => {
      toast.error(`Failed to link transaction: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("service_payments")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
      toast.success("Transaction unlinked from service");
    },
    onError: (error) => {
      toast.error(`Failed to unlink transaction: ${error.message}`);
    },
  });

  const deleteByTransactionId = useMutation({
    mutationFn: async (transactionId: string) => {
      const { error } = await supabase
        .from("service_payments")
        .delete()
        .eq("transaction_id", transactionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
    },
  });

  return {
    payments,
    isLoading,
    error,
    createPayment: createMutation.mutateAsync,
    deletePayment: deleteMutation.mutate,
    deleteByTransactionId: deleteByTransactionId.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
