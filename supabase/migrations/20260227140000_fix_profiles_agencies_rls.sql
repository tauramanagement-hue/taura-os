-- Fix profiles/agencies: ensure tables exist with required columns and RLS for 406/401 fixes

-- 1) Agencies: create if not exists with required columns
CREATE TABLE IF NOT EXISTS public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  sport_sector TEXT,
  agency_type TEXT DEFAULT 'talent',
  plan TEXT DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS roster_size_range TEXT;
ALTER TABLE public.agencies ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- 2) Profiles: create if not exists (depends on auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id),
  full_name TEXT,
  email TEXT NOT NULL DEFAULT '',
  role TEXT DEFAULT 'admin',
  last_briefing_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- 3) RLS
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) Drop existing policies to avoid duplicates (by name)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own agency" ON public.agencies;
DROP POLICY IF EXISTS "Users can update own agency" ON public.agencies;
DROP POLICY IF EXISTS "Anyone can create agency" ON public.agencies;
DROP POLICY IF EXISTS "Authenticated users can create agency" ON public.agencies;
DROP POLICY IF EXISTS "Authenticated users can view agencies for onboarding" ON public.agencies;

-- 5) Profiles: authenticated can read/write their own row
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- 6) Agencies: authenticated can read their own agency (via profile)
CREATE POLICY "Users can view own agency" ON public.agencies
  FOR SELECT TO authenticated USING (
    id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Users can update own agency" ON public.agencies
  FOR UPDATE TO authenticated USING (
    id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  );
-- Allow creating agency (e.g. onboarding) when authenticated
CREATE POLICY "Authenticated users can create agency" ON public.agencies
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
-- Onboarding: list agencies to join
CREATE POLICY "Authenticated users can view agencies for onboarding" ON public.agencies
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- 7) Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
