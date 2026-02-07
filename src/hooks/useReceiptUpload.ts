import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  uploadTransactionReceipt,
  deleteTransactionReceipt,
  getReceiptSignedUrl,
} from "@/lib/receiptUpload";

interface UploadReceiptParams {
  file: File;
  transactionId: string;
}

interface RemoveReceiptParams {
  transactionId: string;
  receiptPath: string;
}

export function useReceiptUpload() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadMutation = useMutation({
    mutationFn: async ({ file, transactionId }: UploadReceiptParams) => {
      if (!user) throw new Error("Not authenticated");

      setUploadProgress(10);

      // Upload to storage
      const receiptPath = await uploadTransactionReceipt(
        file,
        user.id,
        transactionId
      );

      setUploadProgress(70);

      // Update transaction with receipt info
      const { error } = await supabase
        .from("transactions")
        .update({
          receipt_path: receiptPath,
          receipt_uploaded_at: new Date().toISOString(),
          receipt_source: "manual",
        })
        .eq("id", transactionId);

      if (error) throw new Error(`Failed to attach receipt: ${error.message}`);

      setUploadProgress(100);
      return receiptPath;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Receipt uploaded",
        description: "Your receipt has been attached to the transaction.",
      });
      setUploadProgress(0);
    },
    onError: (error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadProgress(0);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async ({ transactionId, receiptPath }: RemoveReceiptParams) => {
      if (!user) throw new Error("Not authenticated");

      // Delete from storage
      await deleteTransactionReceipt(user.id, transactionId, receiptPath);

      // Clear receipt info from transaction
      const { error } = await supabase
        .from("transactions")
        .update({
          receipt_path: null,
          receipt_uploaded_at: null,
          receipt_source: null,
        })
        .eq("id", transactionId);

      if (error) throw new Error(`Failed to remove receipt: ${error.message}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      toast({
        title: "Receipt removed",
        description: "The receipt has been removed from the transaction.",
      });
    },
    onError: (error) => {
      toast({
        title: "Remove failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getSignedUrl = useCallback(async (receiptPath: string | null) => {
    if (!receiptPath) return null;
    return getReceiptSignedUrl(receiptPath);
  }, []);

  return {
    uploadReceipt: uploadMutation.mutate,
    removeReceipt: removeMutation.mutate,
    isUploading: uploadMutation.isPending,
    isRemoving: removeMutation.isPending,
    uploadProgress,
    getSignedUrl,
  };
}
