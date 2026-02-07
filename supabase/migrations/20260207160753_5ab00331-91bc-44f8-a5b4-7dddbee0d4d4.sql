-- Add receipt fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS receipt_path text,
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS receipt_source text;

-- Create private storage bucket for transaction receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transaction-receipts',
  'transaction-receipts',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for transaction-receipts bucket
-- Users can only access their own folder: {user_id}/{transaction_id}/

-- INSERT policy: users can upload to their own folder
CREATE POLICY "Users can upload receipts to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'transaction-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT policy: users can view receipts in their own folder
CREATE POLICY "Users can view receipts in own folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'transaction-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE policy: users can update receipts in their own folder
CREATE POLICY "Users can update receipts in own folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'transaction-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- DELETE policy: users can delete receipts in their own folder
CREATE POLICY "Users can delete receipts in own folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'transaction-receipts' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);