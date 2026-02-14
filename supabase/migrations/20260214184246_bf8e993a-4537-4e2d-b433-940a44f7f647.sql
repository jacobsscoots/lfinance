-- Fix 1: Make toiletry-images bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'toiletry-images';

-- Drop overly permissive public SELECT policy
DROP POLICY IF EXISTS "Toiletry images are publicly accessible" ON storage.objects;

-- Replace with authenticated user-scoped SELECT policy
CREATE POLICY "Users can view own toiletry images"
ON storage.objects FOR SELECT
USING (bucket_id = 'toiletry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Fix 2: Restrict uk_bank_holidays to authenticated users only
DROP POLICY IF EXISTS "Anyone can read bank holidays" ON public.uk_bank_holidays;

CREATE POLICY "Authenticated users can read bank holidays" 
ON public.uk_bank_holidays FOR SELECT 
USING (auth.uid() IS NOT NULL);