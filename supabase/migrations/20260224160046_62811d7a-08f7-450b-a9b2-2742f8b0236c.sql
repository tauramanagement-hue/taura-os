
-- Fix function search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix permissive agency insert policy
DROP POLICY "Anyone can create agency" ON public.agencies;
CREATE POLICY "Authenticated users can create agency" ON public.agencies FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
