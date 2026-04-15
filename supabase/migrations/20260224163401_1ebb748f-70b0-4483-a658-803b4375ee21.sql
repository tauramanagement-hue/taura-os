INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contracts',
  'contracts',
  false,
  20971520,
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
);

CREATE POLICY "Users can upload contract files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  (storage.foldername(name))[1] IN (
    SELECT agency_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can view own agency contract files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'contracts' AND
  (storage.foldername(name))[1] IN (
    SELECT agency_id::text FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete own agency contract files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'contracts' AND
  (storage.foldername(name))[1] IN (
    SELECT agency_id::text FROM profiles WHERE id = auth.uid()
  )
);