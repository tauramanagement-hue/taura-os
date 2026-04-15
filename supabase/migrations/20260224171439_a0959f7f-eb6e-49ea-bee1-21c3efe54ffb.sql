-- Campaigns table
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id),
  name text NOT NULL,
  brand text NOT NULL,
  description text,
  brief_file_url text,
  status text DEFAULT 'active',
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Campaign deliverables (one per talent per content piece)
CREATE TABLE public.campaign_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  athlete_id uuid REFERENCES public.athletes(id),
  content_type text NOT NULL,
  scheduled_date date,
  description text,
  ai_overview text,
  content_approved boolean DEFAULT false,
  post_confirmed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for campaigns
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view agency campaigns" ON public.campaigns
  FOR SELECT USING (agency_id IN (SELECT profiles.agency_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can manage agency campaigns" ON public.campaigns
  FOR ALL USING (agency_id IN (SELECT profiles.agency_id FROM profiles WHERE profiles.id = auth.uid()));

CREATE POLICY "Users can view campaign deliverables" ON public.campaign_deliverables
  FOR SELECT USING (campaign_id IN (
    SELECT c.id FROM campaigns c JOIN profiles p ON c.agency_id = p.agency_id WHERE p.id = auth.uid()
  ));

CREATE POLICY "Users can manage campaign deliverables" ON public.campaign_deliverables
  FOR ALL USING (campaign_id IN (
    SELECT c.id FROM campaigns c JOIN profiles p ON c.agency_id = p.agency_id WHERE p.id = auth.uid()
  ));