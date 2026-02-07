import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  validatePayslipFile,
  uploadPayslipFile,
  deletePayslipFile,
  fileToBase64,
} from "@/lib/payslipUpload";

export interface Payslip {
  id: string;
  user_id: string;
  file_path: string;
  uploaded_at: string;
  gross_pay: number | null;
  net_pay: number | null;
  tax_deducted: number | null;
  ni_deducted: number | null;
  pension_deducted: number | null;
  pay_period_start: string | null;
  pay_period_end: string | null;
  employer_name: string | null;
  extraction_confidence: "high" | "medium" | "low" | null;
  extraction_raw: Record<string, unknown> | null;
  matched_transaction_id: string | null;
  match_status: "pending" | "auto_matched" | "manual_matched" | "no_match";
  matched_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayslipUpdateInput {
  gross_pay?: number | null;
  net_pay?: number | null;
  tax_deducted?: number | null;
  ni_deducted?: number | null;
  pension_deducted?: number | null;
  pay_period_start?: string | null;
  pay_period_end?: string | null;
  employer_name?: string | null;
}

export function usePayslips() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: payslips = [], isLoading } = useQuery({
    queryKey: ["payslips", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("payslips")
        .select("*")
        .eq("user_id", user.id)
        .order("pay_period_end", { ascending: false, nullsFirst: false });

      if (error) throw error;
      return data as Payslip[];
    },
    enabled: !!user?.id,
  });

  const uploadPayslip = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Validate file
      const validation = validatePayslipFile(file);
      if (!validation.valid) throw new Error(validation.error);

      // Create payslip record first to get ID
      const { data: payslipRecord, error: insertError } = await supabase
        .from("payslips")
        .insert({
          user_id: user.id,
          file_path: "pending", // Will update after upload
          match_status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      try {
        // Upload file to storage
        const filePath = await uploadPayslipFile(file, user.id, payslipRecord.id);

        // Update record with actual path
        const { error: updateError } = await supabase
          .from("payslips")
          .update({ file_path: filePath })
          .eq("id", payslipRecord.id);

        if (updateError) throw updateError;

        // Extract payslip data via edge function
        const base64 = await fileToBase64(file);
        const mimeType = file.type;

        const { data: extractionData, error: extractionError } = await supabase.functions.invoke(
          "extract-payslip",
          {
            body: {
              payslipId: payslipRecord.id,
              imageBase64: base64,
              mimeType,
            },
          }
        );

        if (extractionError) {
          console.error("Extraction failed:", extractionError);
          toast.error("Payslip uploaded but extraction failed");
        }

        return { ...payslipRecord, ...extractionData?.payslip };
      } catch (error) {
        // Clean up on failure
        await supabase.from("payslips").delete().eq("id", payslipRecord.id);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payslip uploaded and processed");
    },
    onError: (error) => {
      console.error("Failed to upload payslip:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload payslip");
    },
  });

  const updatePayslip = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: PayslipUpdateInput }) => {
      const { data, error } = await supabase
        .from("payslips")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as Payslip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payslip updated");
    },
    onError: (error) => {
      console.error("Failed to update payslip:", error);
      toast.error("Failed to update payslip");
    },
  });

  const matchTransaction = useMutation({
    mutationFn: async ({ payslipId, transactionId }: { payslipId: string; transactionId: string | null }) => {
      const { data, error } = await supabase
        .from("payslips")
        .update({
          matched_transaction_id: transactionId,
          match_status: transactionId ? "manual_matched" : "no_match",
          matched_at: transactionId ? new Date().toISOString() : null,
        })
        .eq("id", payslipId)
        .select()
        .single();

      if (error) throw error;
      return data as Payslip;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success(variables.transactionId ? "Transaction linked" : "Transaction unlinked");
    },
    onError: (error) => {
      console.error("Failed to match transaction:", error);
      toast.error("Failed to update match");
    },
  });

  const deletePayslip = useMutation({
    mutationFn: async (payslip: Payslip) => {
      // Delete file from storage
      if (payslip.file_path && payslip.file_path !== "pending") {
        await deletePayslipFile(payslip.file_path).catch(console.error);
      }

      // Delete record
      const { error } = await supabase
        .from("payslips")
        .delete()
        .eq("id", payslip.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payslips"] });
      toast.success("Payslip deleted");
    },
    onError: (error) => {
      console.error("Failed to delete payslip:", error);
      toast.error("Failed to delete payslip");
    },
  });

  return {
    payslips,
    isLoading,
    uploadPayslip: uploadPayslip.mutate,
    isUploading: uploadPayslip.isPending,
    updatePayslip: updatePayslip.mutate,
    isUpdating: updatePayslip.isPending,
    matchTransaction: matchTransaction.mutate,
    isMatching: matchTransaction.isPending,
    deletePayslip: deletePayslip.mutate,
    isDeleting: deletePayslip.isPending,
  };
}
