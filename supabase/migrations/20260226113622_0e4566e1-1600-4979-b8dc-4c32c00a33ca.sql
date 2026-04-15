
ALTER TABLE campaign_deliverables ADD COLUMN IF NOT EXISTS impressions INTEGER;
ALTER TABLE campaign_deliverables ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(5,2);
ALTER TABLE campaign_deliverables ADD COLUMN IF NOT EXISTS reach INTEGER;
ALTER TABLE campaign_deliverables ADD COLUMN IF NOT EXISTS link_clicks INTEGER;

CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID REFERENCES public.agencies(id) NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id),
  athlete_id UUID REFERENCES public.athletes(id),
  report_type TEXT NOT NULL DEFAULT 'proof_package',
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage agency reports" ON public.reports FOR ALL USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Users can view agency reports" ON public.reports FOR SELECT USING (
  agency_id IN (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_briefing_date DATE;
