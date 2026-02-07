import { supabase } from "@/integrations/supabase/client";

// Assumptions (locked):
// 1. One receipt per transaction (v1)
// 2. Receipts stored privately in Supabase Storage
// 3. OCR and parsing deferred
// 4. Signed URLs generated on demand, not stored

const BUCKET_NAME = "transaction-receipts";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

export interface ReceiptValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file for receipt upload
 * Checks MIME type and file size
 */
export function validateReceiptFile(file: File): ReceiptValidationResult {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Invalid file type. Please upload a JPG, PNG, WebP, or PDF file.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File too large. Maximum size is 10MB.",
    };
  }

  return { valid: true };
}

/**
 * Generates the storage path for a receipt
 * Format: {userId}/{transactionId}/receipt.{ext}
 */
export function getReceiptStoragePath(
  userId: string,
  transactionId: string,
  fileName: string
): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/${transactionId}/receipt.${ext}`;
}

/**
 * Uploads a receipt file to Supabase Storage
 * Returns the storage path (NOT a signed URL)
 */
export async function uploadTransactionReceipt(
  file: File,
  userId: string,
  transactionId: string
): Promise<string> {
  const validation = validateReceiptFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const filePath = getReceiptStoragePath(userId, transactionId, file.name);

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, file, { upsert: true });

  if (error) {
    throw new Error(`Failed to upload receipt: ${error.message}`);
  }

  return filePath;
}

/**
 * Deletes a receipt file from Supabase Storage
 */
export async function deleteTransactionReceipt(
  userId: string,
  transactionId: string,
  receiptPath: string
): Promise<void> {
  // Extract just the path if it includes the bucket name
  const cleanPath = receiptPath.startsWith(`${userId}/`)
    ? receiptPath
    : `${userId}/${transactionId}/${receiptPath.split("/").pop()}`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([cleanPath]);

  if (error) {
    throw new Error(`Failed to delete receipt: ${error.message}`);
  }
}

/**
 * Generates a signed URL for a receipt
 * URLs are short-lived (1 hour) for security
 */
export async function getReceiptSignedUrl(
  receiptPath: string
): Promise<string | null> {
  if (!receiptPath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(receiptPath, SIGNED_URL_EXPIRY);

  if (error) {
    console.error("Failed to generate signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Checks if a receipt path points to a PDF file
 */
export function isReceiptPdf(receiptPath: string | null): boolean {
  if (!receiptPath) return false;
  return receiptPath.toLowerCase().endsWith(".pdf");
}

/**
 * Gets the file extension from a receipt path
 */
export function getReceiptExtension(receiptPath: string | null): string {
  if (!receiptPath) return "";
  return receiptPath.split(".").pop()?.toLowerCase() || "";
}
