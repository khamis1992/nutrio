-- Create storage bucket for meal images
INSERT INTO storage.buckets (id, name, public)
VALUES ('meal-images', 'meal-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Meal images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'meal-images');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload meal images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

-- Create policy for authenticated users to update their uploads
CREATE POLICY "Authenticated users can update meal images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');

-- Create policy for authenticated users to delete their uploads
CREATE POLICY "Authenticated users can delete meal images"
ON storage.objects FOR DELETE
USING (bucket_id = 'meal-images' AND auth.role() = 'authenticated');