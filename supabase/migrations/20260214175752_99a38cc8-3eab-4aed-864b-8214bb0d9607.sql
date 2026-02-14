-- Create public storage bucket for toiletry item photos
INSERT INTO storage.buckets (id, name, public) VALUES ('toiletry-images', 'toiletry-images', true);

-- Anyone can view toiletry images (public bucket)
CREATE POLICY "Toiletry images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'toiletry-images');

-- Authenticated users can upload their own toiletry images
CREATE POLICY "Users can upload toiletry images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'toiletry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own toiletry images
CREATE POLICY "Users can update toiletry images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'toiletry-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own toiletry images
CREATE POLICY "Users can delete toiletry images"
ON storage.objects FOR DELETE
USING (bucket_id = 'toiletry-images' AND auth.uid()::text = (storage.foldername(name))[1]);