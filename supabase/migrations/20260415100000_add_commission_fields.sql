-- ============================================================
-- Commissioni: default agenzia + override per singolo contratto
-- ============================================================

-- Default commissione sull'agenzia
ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS default_commission_type TEXT DEFAULT 'pct',   -- 'pct' | 'fixed'
  ADD COLUMN IF NOT EXISTS default_commission_value NUMERIC DEFAULT 15;  -- 15% o valore fisso

-- Override per singolo contratto (se NULL usa il default agenzia)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS commission_type TEXT DEFAULT NULL,   -- 'pct' | 'fixed' | NULL
  ADD COLUMN IF NOT EXISTS commission_value NUMERIC DEFAULT NULL;
