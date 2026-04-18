-- AI routing observability table
-- Each row = one routing decision + outcome of the QIE pipeline
-- Writes are service-role only (edge function). Users can read only their own agency rows.

CREATE TABLE IF NOT EXISTS public.ai_routing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID NOT NULL,
  agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE,
  user_id UUID,
  thread_id TEXT,                         -- free-form (UI threads are not DB rows yet)

  -- Input
  query_text TEXT NOT NULL,
  query_lang TEXT,
  attachment_count INTEGER DEFAULT 0,
  conversation_length INTEGER DEFAULT 0,

  -- QIE classification
  domain TEXT NOT NULL,
  domain_confidence NUMERIC(4,3),
  entities JSONB NOT NULL DEFAULT '{}'::jsonb,
  chain TEXT[] DEFAULT '{}',              -- multi-step sub-domains, if any

  -- QIE data-quality signal (full | partial | insufficient)
  data_quality TEXT,

  -- Complexity router
  score INTEGER NOT NULL,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,  -- rule label → points
  scoring_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,  -- human-readable list
  model_level TEXT NOT NULL,                           -- L1 | L2 | L3
  model_selected TEXT NOT NULL,                        -- model id (gemini-2.5-flash, claude-sonnet-..., etc)
  override_reason TEXT,

  -- Outcome
  response_time_ms INTEGER,
  response_tokens INTEGER,
  response_ok BOOLEAN DEFAULT true,
  error TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_routing_logs_agency_created
  ON public.ai_routing_logs (agency_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_routing_logs_domain
  ON public.ai_routing_logs (domain);
CREATE INDEX IF NOT EXISTS idx_ai_routing_logs_query_id
  ON public.ai_routing_logs (query_id);
CREATE INDEX IF NOT EXISTS idx_ai_routing_logs_model_level
  ON public.ai_routing_logs (model_level);

-- RLS
ALTER TABLE public.ai_routing_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_routing_logs_select ON public.ai_routing_logs;
CREATE POLICY ai_routing_logs_select ON public.ai_routing_logs
  FOR SELECT
  TO authenticated
  USING (
    agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
  );

-- No user INSERT/UPDATE/DELETE policies: writes happen from service-role only.

COMMENT ON TABLE public.ai_routing_logs IS
  'Observability for Taura AI: QIE classification, complexity score + per-signal breakdown, model selection, outcome. Service-role writes only.';
COMMENT ON COLUMN public.ai_routing_logs.score_breakdown IS
  'Per-signal points, e.g. {"domain:ranking/comparison": 10, "tokens 0-200": 5}. Used for classifier calibration analytics.';
COMMENT ON COLUMN public.ai_routing_logs.data_quality IS
  'QIE fetcher confidence in the returned payload (full | partial | insufficient). When insufficient the router bumps level +1.';
