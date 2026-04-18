-- Add file columns for deliverables and athletes, extend campaign_deliverables with metrics.
-- All idempotent (IF NOT EXISTS / DO blocks).

-- 1. Athletes: media kit URL
ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS media_kit_url TEXT;

-- 2. Campaign deliverables: uploaded file + performance metrics
ALTER TABLE public.campaign_deliverables
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS impressions INTEGER,
  ADD COLUMN IF NOT EXISTS reach INTEGER,
  ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 3. Deals: ensure notes column exists (some earlier migrations may be missing it)
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. Contracts: ensure notes column exists
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS notes TEXT;
