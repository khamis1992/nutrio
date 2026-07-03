INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blood-reports',
  'blood-reports',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf'];

DROP POLICY IF EXISTS "Users can upload their own blood reports" ON storage.objects;
CREATE POLICY "Users can upload their own blood reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read their own blood reports" ON storage.objects;
CREATE POLICY "Users can read their own blood reports"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can update their own blood reports" ON storage.objects;
CREATE POLICY "Users can update their own blood reports"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can delete their own blood reports" ON storage.objects;
CREATE POLICY "Users can delete their own blood reports"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'blood-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Public read access for blood reports" ON storage.objects;
CREATE POLICY "Public read access for blood reports"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'blood-reports');
