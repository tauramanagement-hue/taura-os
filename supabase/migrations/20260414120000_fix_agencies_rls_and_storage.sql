-- Fix agencies RLS: remove overly permissive onboarding SELECT policy
-- (join-agency feature removed; users now can only create new agencies)
DROP POLICY IF EXISTS "Authenticated users can view agencies for onboarding" ON public.agencies;

-- Storage RLS: add policies for briefs, media-kits, deliverables, temp-uploads
-- (Only contracts bucket had RLS before)

-- briefs bucket
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('briefs', 'briefs', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

CREATE POLICY "Agency members can upload briefs" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can read briefs" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can delete briefs" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'briefs' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- media-kits bucket
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('media-kits', 'media-kits', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

CREATE POLICY "Agency members can upload media-kits" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'media-kits' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can read media-kits" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'media-kits' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can delete media-kits" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'media-kits' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );

-- temp-uploads bucket
DO $$ BEGIN
  INSERT INTO storage.buckets (id, name, public) VALUES ('temp-uploads', 'temp-uploads', false)
  ON CONFLICT (id) DO NOTHING;
END $$;

CREATE POLICY "Agency members can upload temp files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can read temp files" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
CREATE POLICY "Agency members can delete temp files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'temp-uploads' AND
    (storage.foldername(name))[1] IN (
      SELECT agency_id::text FROM public.profiles WHERE id = auth.uid()
    )
  );
