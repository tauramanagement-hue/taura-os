-- Allow authenticated users to see agencies during onboarding (to join existing ones)
CREATE POLICY "Authenticated users can view agencies for onboarding" ON public.agencies
  FOR SELECT
  USING (auth.uid() IS NOT NULL);