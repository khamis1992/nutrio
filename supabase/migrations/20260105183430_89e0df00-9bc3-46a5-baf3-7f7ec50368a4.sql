-- Create storage bucket for meal images
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true);

-- Allow authenticated users to upload meal images
CREATE POLICY "Partners can upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'meal-images' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view meal images (public bucket)
CREATE POLICY "Anyone can view meal images"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');

-- Allow partners to update their meal images
CREATE POLICY "Partners can update meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

-- Allow partners to delete their meal images
CREATE POLICY "Partners can delete meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');