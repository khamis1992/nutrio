-- Create storage bucket for restaurant logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-logos', 'restaurant-logos', true);

-- Allow authenticated users to upload their restaurant logo
CREATE POLICY "Partners can upload their restaurant logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'restaurant-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view restaurant logos (public bucket)
CREATE POLICY "Anyone can view restaurant logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'restaurant-logos');

-- Allow partners to update their own restaurant logo
CREATE POLICY "Partners can update their restaurant logo"
ON storage.objects FOR UPDATE
USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');

-- Allow partners to delete their own restaurant logo
CREATE POLICY "Partners can delete their restaurant logo"
ON storage.objects FOR DELETE
USING (bucket_id = 'restaurant-logos' AND auth.role() = 'authenticated');