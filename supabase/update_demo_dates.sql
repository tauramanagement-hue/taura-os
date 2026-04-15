-- ============================================================
-- TAURA MANAGEMENT — Demo Date Refresh
-- Run date: 2026-04-14
-- Aggiorna date per demo: contratti, campagne, deliverable, notifiche
-- ============================================================

-- ============================================================
-- 1. CONTRATTI SCADUTI → Rinnova a date future plausibili
-- ============================================================

-- Gucci Beauty (Sofia Marchetti) — scaduto 31/03 → in scadenza a breve (urgenza per demo)
UPDATE public.contracts SET end_date = '2026-05-31'
WHERE id = 'c0000001-0005-4000-b000-000000000005';

-- Booking.com (Giulia Ferrari) — scaduto 31/03 → scade fine giugno
UPDATE public.contracts SET end_date = '2026-06-30'
WHERE id = 'c0000001-0008-4000-b000-000000000009';

-- Armani Beauty (Beatrice Conforti) — scade 31/05, ottimo per urgenza demo → lascia ma aggiorna notifica
-- Wilson (Riccardo Mancini) — scade 30/04, buona tensione → lascia

-- Chiara Garnier — scade 30/04 → buona tensione per demo, lascia
-- Intimissimi — scade 30/06 → ok

-- ============================================================
-- 2. CAMPAGNE — End date aggiornate per avere deliverable futuri
-- ============================================================

-- Zalando: estendi fine campagna per avere contenuti futuri
UPDATE public.campaigns SET end_date = '2026-06-30'
WHERE id = 'd0000001-0001-4000-c000-000000000001';

-- Samsung: estendi (attualmente 30/04 troppo vicino)
UPDATE public.campaigns SET end_date = '2026-06-30'
WHERE id = 'd0000001-0006-4000-c000-000000000006';

-- ============================================================
-- 3. DELIVERABLE NON PUBBLICATI → Date future (da oggi in poi)
-- ============================================================

-- === ZALANDO (Sofia Marchetti) ===
-- Post 15/03 non pubblicato → 25 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-25'
WHERE campaign_id = 'd0000001-0001-4000-c000-000000000001'
  AND athlete_id   = 'a0000001-0002-4000-a000-000000000002'
  AND content_type = 'Instagram Post'
  AND scheduled_date = '2026-03-15'
  AND post_confirmed = false;

-- Reel 01/04 non pubblicato → 8 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-08'
WHERE campaign_id = 'd0000001-0001-4000-c000-000000000001'
  AND athlete_id   = 'a0000001-0002-4000-a000-000000000002'
  AND content_type = 'Instagram Reel'
  AND scheduled_date = '2026-04-01'
  AND post_confirmed = false;

-- Story Set 15/04 non pubblicato → 25 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-25'
WHERE campaign_id = 'd0000001-0001-4000-c000-000000000001'
  AND athlete_id   = 'a0000001-0002-4000-a000-000000000002'
  AND content_type = 'Story Set x3'
  AND post_confirmed = false;

-- === ITA AIRWAYS (Giulia Ferrari) ===
-- YouTube 01/03 non pubblicato → 30 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-30'
WHERE campaign_id = 'd0000001-0002-4000-c000-000000000002'
  AND athlete_id   = 'a0000001-0008-4000-a000-000000000008'
  AND content_type = 'YouTube Video'
  AND post_confirmed = false;

-- Reels 15/04 → 15 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-15'
WHERE campaign_id = 'd0000001-0002-4000-c000-000000000002'
  AND athlete_id   = 'a0000001-0008-4000-a000-000000000008'
  AND content_type = 'Instagram Reel x2'
  AND post_confirmed = false;

-- === L'ORÉAL PARIS (Chiara Romano) ===
-- TikTok 20/03 non pubblicato → 22 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-22'
WHERE campaign_id = 'd0000001-0003-4000-c000-000000000003'
  AND athlete_id   = 'a0000001-0004-4000-a000-000000000004'
  AND content_type = 'TikTok'
  AND post_confirmed = false;

-- Post chiusura 30/04 → 20 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-20'
WHERE campaign_id = 'd0000001-0003-4000-c000-000000000003'
  AND athlete_id   = 'a0000001-0004-4000-a000-000000000004'
  AND scheduled_date = '2026-04-30'
  AND post_confirmed = false;

-- === MYPROTEIN (Valentina Esposito) ===
-- TikTok 10/03 non pubblicato → 20 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-20'
WHERE campaign_id = 'd0000001-0004-4000-c000-000000000004'
  AND athlete_id   = 'a0000001-0006-4000-a000-000000000006'
  AND content_type = 'TikTok'
  AND post_confirmed = false;

-- Post summer prep 01/04 non pubblicato → 1 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-01'
WHERE campaign_id = 'd0000001-0004-4000-c000-000000000004'
  AND athlete_id   = 'a0000001-0006-4000-a000-000000000006'
  AND scheduled_date = '2026-04-01'
  AND post_confirmed = false;

-- === ARMANI BEAUTY (Beatrice Conforti) ===
-- Spring look 20/03 non pubblicato → 25 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-25'
WHERE campaign_id = 'd0000001-0005-4000-c000-000000000005'
  AND athlete_id   = 'a0000001-000c-4000-a000-00000000000c'
  AND content_type = 'Instagram Post'
  AND scheduled_date = '2026-03-20'
  AND post_confirmed = false;

-- === SAMSUNG (Elisa Martini) ===
-- TikTok 15/03 non pubblicato → 20 aprile
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-04-20'
WHERE campaign_id = 'd0000001-0006-4000-c000-000000000006'
  AND athlete_id   = 'a0000001-000e-4000-a000-00000000000e'
  AND content_type = 'TikTok'
  AND scheduled_date = '2026-03-15'
  AND post_confirmed = false;

-- Post finale 01/04 → 10 maggio
UPDATE public.campaign_deliverables
SET scheduled_date = '2026-05-10'
WHERE campaign_id = 'd0000001-0006-4000-c000-000000000006'
  AND athlete_id   = 'a0000001-000e-4000-a000-00000000000e'
  AND content_type = 'Instagram Post'
  AND scheduled_date = '2026-04-01'
  AND post_confirmed = false;

-- ============================================================
-- 4. NOTIFICHE — Aggiorna timestamps a oggi/ieri
-- ============================================================
UPDATE public.notifications
SET created_at = now() - interval '2 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND type = 'deadline' AND title = 'Scadenza contratto Armani Beauty';

UPDATE public.notifications
SET created_at = now() - interval '4 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND type = 'conflict';

UPDATE public.notifications
SET
  created_at = now() - interval '1 day',
  title   = 'Scadenza Gucci Beauty — 47 giorni',
  message = 'Contratto Gucci Beauty di Sofia Marchetti scade il 31/05/2026 — avvia rinnovo.'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND title = 'Scadenza Gucci Beauty';

UPDATE public.notifications
SET
  created_at = now() - interval '6 hours',
  title   = 'Reel Zalando da pubblicare — scadenza 08/05',
  message = 'Deliverable Instagram Reel Zalando di Sofia Marchetti non ancora pubblicato — scadenza 08/05/2026.'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND title = 'Reel Zalando non approvato';

UPDATE public.notifications
SET created_at = now() - interval '3 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND title = 'Potenziale conflitto Mercedes/Maserati';

UPDATE public.notifications
SET created_at = now() - interval '12 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND title IN ('Deal Rolex in inbound', 'Scadenza Booking.com', 'Nuovo deal Emirates');

-- ============================================================
-- 5. ACTIVITIES — Aggiorna timestamps recenti
-- ============================================================
UPDATE public.activities
SET created_at = now() - interval '1 hour'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND activity_type = 'contract_uploaded'
  AND description LIKE '%Armani%';

UPDATE public.activities
SET created_at = now() - interval '3 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND activity_type = 'deal_created'
  AND description LIKE '%Rolex%';

UPDATE public.activities
SET created_at = now() - interval '5 hours'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND activity_type = 'conflict_detected';

UPDATE public.activities
SET created_at = now() - interval '1 day'
WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND activity_type IN ('campaign_created', 'deal_stage_changed', 'contract_uploaded');

-- ============================================================
-- VERIFICA RISULTATI
-- ============================================================
SELECT 'Deliverable non pubblicati' AS check_type, COUNT(*) AS count
FROM public.campaign_deliverables cd
JOIN public.campaigns c ON c.id = cd.campaign_id
WHERE c.agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND cd.post_confirmed = false;

SELECT 'Deliverable con data futura' AS check_type, COUNT(*) AS count
FROM public.campaign_deliverables cd
JOIN public.campaigns c ON c.id = cd.campaign_id
WHERE c.agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
  AND cd.post_confirmed = false
  AND cd.scheduled_date > CURRENT_DATE;
