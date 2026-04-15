
-- Agencies table
CREATE TABLE public.agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport_sector TEXT,
  roster_size_range TEXT,
  plan TEXT DEFAULT 'free',
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  agency_id UUID REFERENCES public.agencies(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'admin',
  avatar_url TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Athletes table
CREATE TABLE public.athletes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  full_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  category TEXT,
  date_of_birth DATE,
  nationality TEXT,
  photo_url TEXT,
  instagram_handle TEXT,
  instagram_followers INTEGER DEFAULT 0,
  tiktok_handle TEXT,
  tiktok_followers INTEGER DEFAULT 0,
  youtube_handle TEXT,
  youtube_followers INTEGER DEFAULT 0,
  notes TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Contracts table
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  athlete_id UUID REFERENCES public.athletes(id) NOT NULL,
  brand TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'active',
  exclusivity_category TEXT,
  exclusivity_territory TEXT,
  obligations TEXT,
  penalties TEXT,
  social_obligations TEXT,
  image_rights TEXT,
  renewal_clause TEXT,
  file_url TEXT,
  ai_extracted_clauses JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conflicts table
CREATE TABLE public.conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  contract_a_id UUID REFERENCES public.contracts(id) NOT NULL,
  contract_b_id UUID REFERENCES public.contracts(id),
  severity TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Deals table
CREATE TABLE public.deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  athlete_id UUID REFERENCES public.athletes(id) NOT NULL,
  brand TEXT NOT NULL,
  value NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  stage TEXT DEFAULT 'inbound',
  probability INTEGER DEFAULT 10,
  deal_type TEXT,
  notes TEXT,
  contact_name TEXT,
  contact_email TEXT,
  expected_close_date DATE,
  last_activity_date DATE DEFAULT CURRENT_DATE,
  assigned_to UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Activities table
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  athlete_id UUID REFERENCES public.athletes(id),
  contract_id UUID REFERENCES public.contracts(id),
  deal_id UUID REFERENCES public.deals(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Chat threads
CREATE TABLE public.chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.chat_threads(id) NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT,
  is_read BOOLEAN DEFAULT false,
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athletes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Agencies: users can access their own agency
CREATE POLICY "Users can view own agency" ON public.agencies FOR SELECT USING (
  id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update own agency" ON public.agencies FOR UPDATE USING (
  id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Anyone can create agency" ON public.agencies FOR INSERT WITH CHECK (true);

-- Athletes: filter by agency_id
CREATE POLICY "Users can view agency athletes" ON public.athletes FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can manage agency athletes" ON public.athletes FOR INSERT WITH CHECK (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update agency athletes" ON public.athletes FOR UPDATE USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can delete agency athletes" ON public.athletes FOR DELETE USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Contracts
CREATE POLICY "Users can view agency contracts" ON public.contracts FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can manage agency contracts" ON public.contracts FOR ALL USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Conflicts
CREATE POLICY "Users can view agency conflicts" ON public.conflicts FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can manage agency conflicts" ON public.conflicts FOR ALL USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Deals
CREATE POLICY "Users can view agency deals" ON public.deals FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can manage agency deals" ON public.deals FOR ALL USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Activities
CREATE POLICY "Users can view agency activities" ON public.activities FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert agency activities" ON public.activities FOR INSERT WITH CHECK (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Chat threads
CREATE POLICY "Users can view own threads" ON public.chat_threads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can create threads" ON public.chat_threads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own threads" ON public.chat_threads FOR UPDATE USING (user_id = auth.uid());

-- Chat messages
CREATE POLICY "Users can view thread messages" ON public.chat_messages FOR SELECT USING (
  thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert thread messages" ON public.chat_messages FOR INSERT WITH CHECK (
  thread_id IN (SELECT id FROM public.chat_threads WHERE user_id = auth.uid())
);

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (
  user_id = auth.uid() OR agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (
  user_id = auth.uid() OR agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);
CREATE POLICY "Users can insert notifications" ON public.notifications FOR INSERT WITH CHECK (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

-- Trigger to auto-create profile on signup
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.deals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
