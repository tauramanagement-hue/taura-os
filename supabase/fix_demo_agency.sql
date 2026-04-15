-- ============================================================
-- FIX: Collegare l'utente all'agenzia demo e verificare i dati
-- Esegui nel SQL Editor di Supabase (una volta per utente/agenzia)
-- ============================================================

-- 1) Crea l'agenzia demo SE NON ESISTE (il seed fa solo UPDATE!)
INSERT INTO public.agencies (id, name, agency_type, sport_sector, plan, onboarding_completed)
VALUES (
  '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c',
  'Taura Management',
  'talent',
  'influencer',
  'enterprise',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  agency_type = EXCLUDED.agency_type,
  sport_sector = EXCLUDED.sport_sector,
  plan = EXCLUDED.plan,
  onboarding_completed = EXCLUDED.onboarding_completed;

-- 2) Collega TUTTI i profili che hanno email demo (o il tuo) all'agenzia
--    Sostituisci 'os@tauramanagement.it' con la tua email se usi un altro account
UPDATE public.profiles
SET agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
WHERE email = 'os@tauramanagement.it';   -- <-- Cambia qui se usi un'altra email

-- 3) Verifica: quanti record vedi per l'agenzia?
--    (Esegui come controllo dopo aver fatto login)
/*
SELECT 'agencies' AS tabella, COUNT(*) AS n FROM public.agencies WHERE id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
UNION ALL
SELECT 'profiles' , COUNT(*) FROM public.profiles WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
UNION ALL
SELECT 'athletes' , COUNT(*) FROM public.athletes WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
UNION ALL
SELECT 'contracts', COUNT(*) FROM public.contracts WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c'
UNION ALL
SELECT 'deals'    , COUNT(*) FROM public.deals WHERE agency_id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c';
*/
