import { supabase } from "@/integrations/supabase/client";
import { optimiseImage } from "./imageOptimiser";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface PayslipValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePayslipFile(file: File): PayslipValidationResult {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "File must be a JPG, PNG, WebP image or PDF",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File must be under 10MB",
    };
  }

  return { valid: true };
}

export function getPayslipStoragePath(userId: string, payslipId: string, filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || "pdf";
  return `${userId}/${payslipId}/original.${extension}`;
}

export async function uploadPayslipFile(
  file: File,
  userId: string,
  payslipId: string
): Promise<string> {
  const optimised = await optimiseImage(file);
  const path = getPayslipStoragePath(userId, payslipId, optimised.name);

  const { error } = await supabase.storage
    .from("payslips")
    .upload(path, optimised, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) throw error;

  return path;
}

export async function deletePayslipFile(path: string): Promise<void> {
  const { error } = await supabase.storage
    .from("payslips")
    .remove([path]);

  if (error) throw error;
}

export async function getPayslipSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("payslips")
    .createSignedUrl(path, 3600); // 1 hour

  if (error) throw error;
  return data.signedUrl;
}

export function isPayslipPdf(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data URL prefix to get just the base64
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
