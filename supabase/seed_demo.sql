-- ============================================================
-- TAURA MANAGEMENT — Demo Seed Data
-- Agency: 6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c
-- Run in Supabase SQL Editor. Idempotent (ON CONFLICT DO NOTHING).
-- ============================================================

-- ============================================================
-- 0. AGENCY UPDATE
-- ============================================================
UPDATE public.agencies
SET
  name              = 'Taura Management',
  agency_type       = 'talent',
  sport_sector      = 'influencer',
  plan              = 'enterprise',
  onboarding_completed = true
WHERE id = '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c';

-- ============================================================
-- 1. ATHLETES (15)
-- ============================================================
DO $$
DECLARE
  aid_agency UUID := '6fac7ab8-4baa-4da2-9447-e3dfeffdbe8c';

  -- Athlete IDs (deterministic so re-runs are safe)
  a_marco      UUID := 'a0000001-0001-4000-a000-000000000001';
  a_sofia      UUID := 'a0000001-0002-4000-a000-000000000002';
  a_luca       UUID := 'a0000001-0003-4000-a000-000000000003';
  a_chiara     UUID := 'a0000001-0004-4000-a000-000000000004';
  a_alessandro UUID := 'a0000001-0005-4000-a000-000000000005';
  a_valentina  UUID := 'a0000001-0006-4000-a000-000000000006';
  a_riccardo   UUID := 'a0000001-0007-4000-a000-000000000007';
  a_giulia     UUID := 'a0000001-0008-4000-a000-000000000008';
  a_matteo     UUID := 'a0000001-0009-4000-a000-000000000009';
  a_aurora     UUID := 'a0000001-000a-4000-a000-00000000000a';
  a_davide     UUID := 'a0000001-000b-4000-a000-00000000000b';
  a_beatrice   UUID := 'a0000001-000c-4000-a000-00000000000c';
  a_federico   UUID := 'a0000001-000d-4000-a000-00000000000d';
  a_elisa      UUID := 'a0000001-000e-4000-a000-00000000000e';
  a_lorenzo    UUID := 'a0000001-000f-4000-a000-00000000000f';

  -- Contract IDs (the ones we need to reference in conflicts)
  c_luca_nike      UUID := 'c0000001-0001-4000-b000-000000000001';
  c_luca_haier     UUID := 'c0000001-0002-4000-b000-000000000002';
  c_luca_ea        UUID := 'c0000001-0003-4000-b000-000000000003';
  c_sofia_zalando  UUID := 'c0000001-0004-4000-b000-000000000004';
  c_sofia_gucci    UUID := 'c0000001-0005-4000-b000-000000000005';
  c_sofia_dyson    UUID := 'c0000001-0006-4000-b000-000000000006';
  c_giulia_ita     UUID := 'c0000001-0007-4000-b000-000000000007';
  c_giulia_booking UUID := 'c0000001-0008-4000-b000-000000000008';
  c_giulia_garmin  UUID := 'c0000001-0009-4000-b000-000000000009';
  c_bea_armani     UUID := 'c0000001-000a-4000-b000-00000000000a';
  c_bea_tiffany    UUID := 'c0000001-000b-4000-b000-00000000000b';
  c_bea_maserati   UUID := 'c0000001-000c-4000-b000-00000000000c';
  c_chiara_loreal  UUID := 'c0000001-000d-4000-b000-00000000000d';
  c_chiara_garnier UUID := 'c0000001-000e-4000-b000-00000000000e';
  c_chiara_intim   UUID := 'c0000001-000f-4000-b000-00000000000f';
  c_vale_myprot    UUID := 'c0000001-0010-4000-b000-000000000010';
  c_vale_techno    UUID := 'c0000001-0011-4000-b000-000000000011';
  c_vale_garmin    UUID := 'c0000001-0012-4000-b000-000000000012';
  c_marco_kappa    UUID := 'c0000001-0013-4000-b000-000000000013';
  c_marco_redbull  UUID := 'c0000001-0014-4000-b000-000000000014';
  c_elisa_spotify  UUID := 'c0000001-0015-4000-b000-000000000015';
  c_elisa_samsung  UUID := 'c0000001-0016-4000-b000-000000000016';
  c_elisa_coca     UUID := 'c0000001-0017-4000-b000-000000000017';
  c_ales_gator     UUID := 'c0000001-0018-4000-b000-000000000018';
  c_ric_wilson     UUID := 'c0000001-0019-4000-b000-000000000019';
  c_fede_head      UUID := 'c0000001-001a-4000-b000-00000000001a';
  c_aurora_barilla UUID := 'c0000001-001b-4000-b000-00000000001b';
  c_davide_sparco  UUID := 'c0000001-001c-4000-b000-00000000001c';
  c_matteo_adidas  UUID := 'c0000001-001d-4000-b000-00000000001d';
  c_lorenzo_nike   UUID := 'c0000001-001e-4000-b000-00000000001e';

  -- Campaign IDs
  camp_zalando   UUID := 'd0000001-0001-4000-c000-000000000001';
  camp_ita       UUID := 'd0000001-0002-4000-c000-000000000002';
  camp_loreal    UUID := 'd0000001-0003-4000-c000-000000000003';
  camp_myprot    UUID := 'd0000001-0004-4000-c000-000000000004';
  camp_armani    UUID := 'd0000001-0005-4000-c000-000000000005';
  camp_samsung   UUID := 'd0000001-0006-4000-c000-000000000006';

  -- Deal IDs (some referenced in activities)
  dl_pepsi     UUID := 'e0000001-0001-4000-d000-000000000001';
  dl_hm        UUID := 'e0000001-0002-4000-d000-000000000002';
  dl_rb_dav    UUID := 'e0000001-0003-4000-d000-000000000003';
  dl_rolex     UUID := 'e0000001-0004-4000-d000-000000000004';
  dl_puma      UUID := 'e0000001-0005-4000-d000-000000000005';
  dl_sephora   UUID := 'e0000001-0006-4000-d000-000000000006';
  dl_emirates  UUID := 'e0000001-0007-4000-d000-000000000007';
  dl_optnutr   UUID := 'e0000001-0008-4000-d000-000000000008';
  dl_spotcol   UUID := 'e0000001-0009-4000-d000-000000000009';
  dl_fiat      UUID := 'e0000001-000a-4000-d000-00000000000a';
  dl_deliveroo UUID := 'e0000001-000b-4000-d000-00000000000b';
  dl_adidas_ch UUID := 'e0000001-000c-4000-d000-00000000000c';
  dl_playstat  UUID := 'e0000001-000d-4000-d000-00000000000d';
  dl_merc      UUID := 'e0000001-000e-4000-d000-00000000000e';
  dl_hublot    UUID := 'e0000001-000f-4000-d000-00000000000f';
  dl_tiktokads UUID := 'e0000001-0010-4000-d000-000000000010';
  dl_samsgal   UUID := 'e0000001-0011-4000-d000-000000000011';
  dl_newbal    UUID := 'e0000001-0012-4000-d000-000000000012';

  -- Conflict IDs
  conf_loreal  UUID := 'f0000001-0001-4000-e000-000000000001';
  conf_myprot  UUID := 'f0000001-0002-4000-e000-000000000002';
  conf_ea      UUID := 'f0000001-0003-4000-e000-000000000003';

BEGIN

  -- --------------------------------------------------------
  -- ATHLETES
  -- --------------------------------------------------------
  INSERT INTO public.athletes (id, agency_id, full_name, sport, category, nationality, instagram_handle, instagram_followers, tiktok_handle, tiktok_followers, youtube_handle, youtube_followers, status, date_of_birth)
  VALUES
    (a_marco,      aid_agency, 'Marco Ferretti',     'Football',           'Serie B',              'Italian', '@marcoferretti23',        485000, '@marcoferretti',      312000, NULL, 0,       'active', '2003-04-12'),
    (a_sofia,      aid_agency, 'Sofia Marchetti',    'Lifestyle/Fashion',  'Influencer',           'Italian', '@sofiamarchetti',        1200000, '@sofia.marchetti',    890000, '@SofiaMarchetti', 245000, 'active', '2000-08-22'),
    (a_luca,       aid_agency, 'Luca Barone',        'Football',           'Serie A',              'Italian', '@lucabarone10',           920000, '@lucabarone',         540000, NULL, 0,       'active', '1998-02-15'),
    (a_chiara,     aid_agency, 'Chiara Romano',      'Beauty/Wellness',    'Influencer',           'Italian', '@chiaraRomano',           780000, '@chiara.romano',     1100000, NULL, 0,       'active', '2002-11-03'),
    (a_alessandro, aid_agency, 'Alessandro Conti',   'Basketball',         'Lega Basket Serie A',  'Italian', '@alessandroconti',        320000, NULL,                       0, NULL, 0,       'active', '1999-06-28'),
    (a_valentina,  aid_agency, 'Valentina Esposito', 'Fitness/Sport',      'Influencer',           'Italian', '@vale.esposito',          650000, '@valentina.esposito', 880000, '@ValentinaFit', 180000, 'active', '1998-09-10'),
    (a_riccardo,   aid_agency, 'Riccardo Mancini',   'Tennis',             'ATP 145',              'Italian', '@riccardo.mancini',       280000, NULL,                       0, NULL, 0,       'active', '2004-01-19'),
    (a_giulia,     aid_agency, 'Giulia Ferrari',     'Travel/Lifestyle',   'Influencer',           'Italian', '@giuliaferrari',         2100000, '@giulia.ferrari',    1400000, '@GiuliaFerrariTravel', 420000, 'active', '1997-03-07'),
    (a_matteo,     aid_agency, 'Matteo Greco',       'Football',           'Serie B',              'Italian', '@matteo.greco',           190000, NULL,                       0, NULL, 0,       'active', '2005-05-30'),
    (a_aurora,     aid_agency, 'Aurora Fontana',     'Food/Lifestyle',     'Influencer',           'Italian', '@aurora.fontana',         560000, '@aurorafontana',      720000, NULL, 0,       'active', '2001-07-14'),
    (a_davide,     aid_agency, 'Davide Lombardi',    'Motorsport',         'F3 European Series',   'Italian', '@davideLombardi_racing',  380000, '@davidelombardi',     290000, NULL, 0,       'active', '2006-10-25'),
    (a_beatrice,   aid_agency, 'Beatrice Conforti',  'Fashion/Luxury',     'Influencer',           'Italian', '@beatrice.conforti',     3200000, NULL,                       0, '@BeatriceConforti', 680000, 'active', '1995-12-01'),
    (a_federico,   aid_agency, 'Federico Russo',     'Padel/Sport',        'Influencer',           'Italian', '@federico.russo.padel',   420000, '@federicorusso',      510000, NULL, 0,       'active', '1996-08-18'),
    (a_elisa,      aid_agency, 'Elisa Martini',      'Music/Social',       'Artist/Influencer',    'Italian', '@elisamartini',           890000, '@elisa.martini',     1600000, '@ElisaMartiniOfficial', 320000, 'active', '2003-02-09'),
    (a_lorenzo,    aid_agency, 'Lorenzo De Luca',    'Football',           'Serie C',              'Italian', '@lorenzodeLuca9',          95000, NULL,                       0, NULL, 0,       'active', '2007-11-22')
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------
  -- CONTRACTS (28)
  -- --------------------------------------------------------

  -- Luca Barone
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, exclusivity_territory, social_obligations, image_rights)
  VALUES
    (c_luca_nike,  aid_agency, a_luca, 'Nike Italia',  'sponsorship',  85000.00, '2025-01-15', '2026-12-31', 'active',  'Sportswear',    'Italia',  '4 post/mese Instagram', 'Italy only'),
    (c_luca_haier, aid_agency, a_luca, 'Haier',        'sponsorship',  28000.00, '2025-06-01', '2026-05-31', 'active',  NULL,            NULL,       NULL, NULL),
    (c_luca_ea,    aid_agency, a_luca, 'EA Sports FC', 'testimonial',  45000.00, '2025-07-01', '2026-06-30', 'active',  'Gaming/Sports', 'Worldwide', '2 post/mese gaming', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Sofia Marchetti
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, social_obligations)
  VALUES
    (c_sofia_zalando, aid_agency, a_sofia, 'Zalando Italia',  'ambassador',       72000.00, '2025-03-01', '2027-02-28', 'active',  'Fashion e-commerce', '8 post/mese'),
    (c_sofia_gucci,   aid_agency, a_sofia, 'Gucci Beauty',    'testimonial',      38000.00, '2025-10-01', '2026-03-31', 'active',  'Luxury beauty',      '3 post collab'),
    (c_sofia_dyson,   aid_agency, a_sofia, 'Dyson',           'content creator',  18500.00, '2025-09-01', '2026-08-31', 'active',  NULL,                 '2 contenuti/mese')
  ON CONFLICT (id) DO NOTHING;

  -- Giulia Ferrari
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, social_obligations)
  VALUES
    (c_giulia_ita,     aid_agency, a_giulia, 'ITA Airways',  'brand ambassador', 95000.00, '2025-01-01', '2026-12-31', 'active',  'Airlines Italia', '6 post/mese'),
    (c_giulia_booking, aid_agency, a_giulia, 'Booking.com',  'content creator',  42000.00, '2025-04-01', '2026-03-31', 'active',  NULL,              '4 contenuti/mese'),
    (c_giulia_garmin,  aid_agency, a_giulia, 'Garmin',       'sponsorship',      22000.00, '2025-08-01', '2027-07-31', 'active',  NULL,              '2 post/mese')
  ON CONFLICT (id) DO NOTHING;

  -- Beatrice Conforti
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category, exclusivity_territory)
  VALUES
    (c_bea_armani,   aid_agency, a_beatrice, 'Armani Beauty', 'ambassador',       140000.00, '2024-06-01', '2026-05-31', 'active',  'Cosmetics/Beauty', 'Global'),
    (c_bea_tiffany,  aid_agency, a_beatrice, 'Tiffany & Co',  'testimonial',      85000.00, '2025-01-01', '2026-12-31', 'active',  'Jewelry',          'Europe'),
    (c_bea_maserati, aid_agency, a_beatrice, 'Maserati',      'brand ambassador', 65000.00, '2025-09-01', '2027-08-31', 'active',  'Luxury automotive', 'Italia')
  ON CONFLICT (id) DO NOTHING;

  -- Chiara Romano
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category)
  VALUES
    (c_chiara_loreal,  aid_agency, a_chiara, 'L''Oréal Paris', 'testimonial',      48000.00, '2025-04-01', '2027-03-31', 'active',  'Cosmetics/Beauty'),
    (c_chiara_garnier, aid_agency, a_chiara, 'Garnier',        'content creator',  12000.00, '2025-11-01', '2026-04-30', 'active',  'Skincare'),
    (c_chiara_intim,   aid_agency, a_chiara, 'Intimissimi',    'content creator',  24000.00, '2025-07-01', '2026-06-30', 'active',  NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Valentina Esposito
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category)
  VALUES
    (c_vale_myprot, aid_agency, a_valentina, 'MyProtein', 'ambassador',       35000.00, '2025-02-01', '2026-12-31', 'active',  'Sports nutrition'),
    (c_vale_techno, aid_agency, a_valentina, 'Technogym', 'brand partner',    28000.00, '2025-05-01', '2026-04-30', 'active',  NULL),
    (c_vale_garmin, aid_agency, a_valentina, 'Garmin',    'content creator',  15000.00, '2025-11-01', '2026-10-31', 'active',  NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Marco Ferretti
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category)
  VALUES
    (c_marco_kappa,   aid_agency, a_marco, 'Kappa',    'kit sponsorship', 18000.00, '2025-08-01', '2026-07-31', 'active',  'Sportswear'),
    (c_marco_redbull, aid_agency, a_marco, 'Red Bull', 'athlete partner', 22000.00, '2025-01-01', '2026-12-31', 'active',  'Energy drinks')
  ON CONFLICT (id) DO NOTHING;

  -- Elisa Martini
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category)
  VALUES
    (c_elisa_spotify, aid_agency, a_elisa, 'Spotify',       'content partner', 55000.00, '2025-06-01', '2026-05-31', 'active',  'Music streaming'),
    (c_elisa_samsung, aid_agency, a_elisa, 'Samsung Italia', 'testimonial',    42000.00, '2025-10-01', '2027-09-30', 'active',  NULL),
    (c_elisa_coca,    aid_agency, a_elisa, 'Coca-Cola',      'ambassador',    38000.00, '2025-03-01', '2026-02-28', 'expired', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Remaining athletes (smaller contracts)
  INSERT INTO public.contracts (id, agency_id, athlete_id, brand, contract_type, value, start_date, end_date, status, exclusivity_category)
  VALUES
    (c_ales_gator,     aid_agency, a_alessandro, 'Gatorade',    'sponsorship',     15000.00, '2025-09-01', '2026-08-31', 'active', 'Sports drink'),
    (c_ric_wilson,     aid_agency, a_riccardo,   'Wilson',      'equipment deal',  12000.00, '2025-05-01', '2026-04-30', 'active', 'Tennis equipment'),
    (c_fede_head,      aid_agency, a_federico,   'Head',        'equipment deal',  16000.00, '2025-06-01', '2026-12-31', 'active', 'Padel equipment'),
    (c_aurora_barilla, aid_agency, a_aurora,     'Barilla',     'content creator', 28000.00, '2025-04-01', '2026-09-30', 'active', 'Food'),
    (c_davide_sparco,  aid_agency, a_davide,     'Sparco',      'sponsorship',     32000.00, '2025-03-01', '2026-12-31', 'active', 'Motorsport apparel'),
    (c_matteo_adidas,  aid_agency, a_matteo,     'Adidas',      'sponsorship',     14000.00, '2025-07-01', '2026-06-30', 'active', 'Sportswear'),
    (c_lorenzo_nike,   aid_agency, a_lorenzo,    'Nike Academy', 'academy deal',    8000.00, '2025-09-01', '2026-08-31', 'active', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------
  -- CONFLICTS (3)
  -- --------------------------------------------------------
  INSERT INTO public.conflicts (id, agency_id, contract_a_id, contract_b_id, severity, conflict_type, description, suggestion, status)
  VALUES
    (conf_loreal, aid_agency, c_chiara_loreal, c_chiara_garnier, 'high', 'exclusivity_violation',
     'Clausola esclusività cosmetica L''Oréal Paris confligge con proposta Garnier (stesso gruppo). Rischio penale €24.000.',
     'Rescindere il contratto Garnier o negoziare una deroga scritta con L''Oréal Paris. Priorità: preservare il contratto L''Oréal (€48k vs €12k).',
     'open'),
    (conf_myprot, aid_agency, c_vale_myprot, NULL, 'medium', 'category_overlap',
     'Esclusività MyProtein su sport nutrition potenzialmente sovrapposta a deal Optimum Nutrition in pipeline.',
     'Verificare wording esclusiva MyProtein (brand vs category). Se category-based, declinare deal ON oppure attendere scadenza MyProtein.',
     'open'),
    (conf_ea,     aid_agency, c_luca_ea, NULL, 'low', 'potential_overlap',
     'Clausola gaming EA Sports FC da verificare prima di procedere con partnership Twitch Gaming.',
     'Richiedere parere legale su scope clausola gaming. Probabile che streaming non rientri se non espressamente citato.',
     'open')
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------
  -- DEALS PIPELINE (18)
  -- --------------------------------------------------------
  INSERT INTO public.deals (id, agency_id, athlete_id, brand, value, stage, probability, deal_type, notes, expected_close_date, created_at)
  VALUES
    -- Inbound (4)
    (dl_pepsi,     aid_agency, a_luca,      'Pepsi',              35000.00, 'inbound',     10, 'sponsorship',    'Primo contatto via email. Interesse per campagna estiva.',                       '2026-06-30', now() - interval '5 days'),
    (dl_hm,        aid_agency, a_sofia,     'H&M',               28000.00, 'inbound',     10, 'content creator', 'Brief preliminare ricevuto, collezione estate 2026.',                           '2026-05-15', now() - interval '3 days'),
    (dl_rb_dav,    aid_agency, a_davide,    'Red Bull Racing',   18000.00, 'inbound',     10, 'athlete partner', 'Scouting young drivers program.',                                               '2026-07-01', now() - interval '7 days'),
    (dl_rolex,     aid_agency, a_beatrice,  'Rolex',            120000.00, 'inbound',     10, 'ambassador',      'Contatto diretto dal brand. Valutare priorità e posizionamento luxury.',        '2026-09-01', now() - interval '2 days'),

    -- Qualified (5)
    (dl_puma,      aid_agency, a_marco,     'Puma',              22000.00, 'qualified',   30, 'sponsorship',    'Call con marketing manager completata. Interesse confermato.',                   '2026-05-01', now() - interval '12 days'),
    (dl_sephora,   aid_agency, a_chiara,    'Sephora',           32000.00, 'qualified',   30, 'ambassador',      'Presentazione portfolio completata. Attendiamo brief formale.',                 '2026-06-01', now() - interval '10 days'),
    (dl_emirates,  aid_agency, a_giulia,    'Emirates',          55000.00, 'qualified',   30, 'ambassador',      'Meeting con team EMEA. Forte interesse per rotte Dubai-Italia.',                '2026-07-01', now() - interval '8 days'),
    (dl_optnutr,   aid_agency, a_valentina, 'Optimum Nutrition', 24000.00, 'qualified',   30, 'sponsorship',    '⚠️ Verifica esclusività MyProtein prima di procedere.',                         '2026-05-15', now() - interval '6 days'),
    (dl_spotcol,   aid_agency, a_elisa,     'Spotify Wrapped Collab', 18000.00, 'qualified', 30, 'content partner', 'Proposta contenuti per campagna Wrapped 2026.',                            '2026-11-01', now() - interval '4 days'),

    -- Proposal (4)
    (dl_fiat,      aid_agency, a_federico,  'Fiat',              28000.00, 'proposal',    55, 'testimonial',    'Proposta inviata per campagna Fiat 600e. Attesa feedback.',                     '2026-04-30', now() - interval '15 days'),
    (dl_deliveroo, aid_agency, a_aurora,    'Deliveroo',         22000.00, 'proposal',    55, 'content creator', 'Proposta #DelizieACasa serie TikTok + Instagram.',                             '2026-04-15', now() - interval '14 days'),
    (dl_adidas_ch, aid_agency, a_chiara,    'adidas Originals',  38000.00, 'proposal',    55, 'ambassador',      'Proposta capsule collection athleisure. Budget confermato.',                   '2026-05-30', now() - interval '11 days'),
    (dl_playstat,  aid_agency, a_alessandro,'PlayStation',       20000.00, 'proposal',    55, 'testimonial',    'NBA 2K27 launch partnership proposta.',                                         '2026-06-15', now() - interval '9 days'),

    -- Negotiation (3)
    (dl_merc,      aid_agency, a_beatrice,  'Mercedes-Benz',    180000.00, 'negotiation', 75, 'ambassador',      '⚠️ Possibile conflitto con esclusiva Maserati luxury automotive. Verificare.', '2026-06-01', now() - interval '20 days'),
    (dl_hublot,    aid_agency, a_luca,      'Hublot',            45000.00, 'negotiation', 75, 'testimonial',    'Terzo round negoziazione. Fee e deliverable quasi definiti.',                   '2026-04-15', now() - interval '18 days'),
    (dl_tiktokads, aid_agency, a_elisa,     'TikTok Ads',        28000.00, 'negotiation', 75, 'content partner', 'Partnership per campagna creator spotlight Q2.',                               '2026-04-30', now() - interval '13 days'),

    -- Signed (2)
    (dl_samsgal,   aid_agency, a_sofia,     'Samsung Galaxy',    35000.00, 'signed',     100, 'testimonial',    'Contratto firmato. Deliverable in fase di pianificazione.',                     '2026-03-01', now() - interval '25 days'),
    (dl_newbal,    aid_agency, a_riccardo,  'New Balance',       19000.00, 'signed',     100, 'sponsorship',    'Deal chiuso per stagione terra rossa 2026.',                                    '2026-04-01', now() - interval '22 days')
  ON CONFLICT (id) DO NOTHING;

  -- --------------------------------------------------------
  -- CAMPAIGNS (6 with deliverables)
  -- --------------------------------------------------------

  -- Campaign 1: Zalando Spring Collection 2026
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_zalando, aid_agency, 'Zalando Spring Collection 2026', 'Zalando Italia', 'Campagna primavera 2026 con Sofia Marchetti. 6 contenuti social.', 'active', '2026-02-01', '2026-04-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_zalando, a_sofia, 'Instagram Post',  '2026-02-10', 'Look primavera outfit completo', 'Look primavera Zalando, outfit completo, tag @zalandoitalia, caption con codice sconto SOFIA15, 3 hashtag brand', true, true),
    (camp_zalando, a_sofia, 'Instagram Reel',  '2026-02-20', 'Reel unboxing 30sec',             'Reel 30sec unboxing collezione spring, musica trending, CTA swipe up', true, true),
    (camp_zalando, a_sofia, 'Story Set x5',    '2026-03-01', 'Story set prima settimana marzo', NULL, true, true),
    (camp_zalando, a_sofia, 'Instagram Post',  '2026-03-15', 'Secondo look mid-season',         'Secondo look mid-season, palette pastello, menzione sostenibilità Zalando', true, false),
    (camp_zalando, a_sofia, 'Instagram Reel',  '2026-04-01', 'Reel finale campagna',            'Reel finale campagna, best of spring looks, link in bio', false, false),
    (camp_zalando, a_sofia, 'Story Set x3',    '2026-04-15', 'Story set chiusura campagna',     NULL, false, false);

  -- Campaign 2: ITA Airways Summer Routes
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_ita, aid_agency, 'ITA Airways Summer Routes 2026', 'ITA Airways', 'Campagna rotte estive con Giulia Ferrari. Travel content multi-piattaforma.', 'active', '2026-01-15', '2026-06-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_ita, a_giulia, 'Instagram Post',     '2026-01-20', 'Annuncio partnership',               'Annuncio partnership ITA Airways, foto in aeroporto Fiumicino, mention rotte estive', true, true),
    (camp_ita, a_giulia, 'YouTube Video',       '2026-03-01', 'Travel vlog Roma-Palermo 8-10 min',  'Video 8-10min travel vlog Roma-Palermo con ITA, mostrare esperienza premium bordo', true, false),
    (camp_ita, a_giulia, 'Instagram Reel x2',   '2026-04-15', 'Reels destinazioni estate',          'Reels destinazioni estate: Sardegna e Sicilia, aesthetic travel content', false, false),
    (camp_ita, a_giulia, 'Blog/IG Carousel',    '2026-06-01', 'Guida destinazioni estate ITA',      NULL, false, false);

  -- Campaign 3: L'Oréal Paris Primavera
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_loreal, aid_agency, 'L''Oréal Paris Primavera 2026', 'L''Oréal Paris', 'Campagna beauty primavera con Chiara Romano. Focus rossetto Infaillible.', 'active', '2026-02-15', '2026-05-31')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_loreal, a_chiara, 'Instagram Post',  '2026-02-20', 'Post lancio collezione primavera',    NULL, true, true),
    (camp_loreal, a_chiara, 'Instagram Reel',  '2026-03-01', 'Tutorial makeup primavera',           'Tutorial makeup primavera con nuovo rossetto Infaillible, 60sec, trending audio', true, true),
    (camp_loreal, a_chiara, 'TikTok',          '2026-03-20', 'TikTok tutorial lips',                'TikTok tutorial lips + liner trend, tag @lorealparisit', true, false),
    (camp_loreal, a_chiara, 'Instagram Post',  '2026-04-30', 'Post chiusura campagna primavera',    NULL, false, false);

  -- Campaign 4: MyProtein Summer Shred
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_myprot, aid_agency, 'MyProtein Summer Shred 2026', 'MyProtein', 'Campagna fitness estate con Valentina Esposito. Impact Whey & BCAA focus.', 'active', '2026-01-01', '2026-08-31')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_myprot, a_valentina, 'Instagram Post', '2026-01-15', 'Post New Year fitness goal',        NULL, true, true),
    (camp_myprot, a_valentina, 'Instagram Post', '2026-02-01', 'Post routine mattina con prodotti', NULL, true, true),
    (camp_myprot, a_valentina, 'Instagram Reel', '2026-02-15', 'Reel workout + shake',              'Reel workout + shake routine mattina, prodotti Impact Whey e BCAA', true, true),
    (camp_myprot, a_valentina, 'TikTok',         '2026-03-10', 'TikTok workout transformation',     NULL, true, false),
    (camp_myprot, a_valentina, 'Instagram Post', '2026-04-01', 'Post summer prep',                  'Post summer prep, bikini season messaging, codice sconto VALE20', false, false),
    (camp_myprot, a_valentina, 'YouTube Integration', '2026-06-01', 'YouTube integration video fitness', NULL, false, false);

  -- Campaign 5: Armani Beauty FW26
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_armani, aid_agency, 'Armani Beauty FW26', 'Armani Beauty', 'Campagna Armani Beauty con Beatrice Conforti. High-end editorial content. Nota: contratto in scadenza 31/05.', 'active', '2026-01-10', '2026-05-31')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_armani, a_beatrice, 'Instagram Post', '2026-01-15', 'Look editoriale Luminous Silk',     'Look editoriale Armani Beauty, fondotinta Luminous Silk, studio photography aesthetic, no heavy filters, caption elegante no emoji', true, true),
    (camp_armani, a_beatrice, 'Instagram Reel', '2026-02-01', 'GRWM Armani Beauty routine',        '60sec get ready with me con Armani Beauty routine, light airy aesthetic', true, true),
    (camp_armani, a_beatrice, 'Instagram Post', '2026-03-20', 'Spring look Eyes To Kill',          'Spring makeup look, nuova palette Eyes To Kill, tag @armanibeauty', true, false),
    (camp_armani, a_beatrice, 'Instagram Reel', '2026-05-01', 'Final campaign Reel',               'Final campaign content, look finale collezione, possibile UGC rights richiesto', false, false);

  -- Campaign 6: Samsung Galaxy S25 Launch
  INSERT INTO public.campaigns (id, agency_id, name, brand, description, status, start_date, end_date)
  VALUES (camp_samsung, aid_agency, 'Samsung Galaxy S25 Launch', 'Samsung Italia', 'Campagna lancio Galaxy S25 con Elisa Martini. Focus camera e lifestyle integration.', 'active', '2026-02-01', '2026-04-30')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.campaign_deliverables (campaign_id, athlete_id, content_type, scheduled_date, description, ai_overview, content_approved, post_confirmed)
  VALUES
    (camp_samsung, a_elisa, 'TikTok',         '2026-02-10', 'Unboxing Galaxy S25',               'Unboxing Galaxy S25, focus camera features, trending sound, 45sec max', true, true),
    (camp_samsung, a_elisa, 'Instagram Reel', '2026-02-20', 'Reel camera comparison',             NULL, true, true),
    (camp_samsung, a_elisa, 'TikTok',         '2026-03-15', 'Day in my life con Galaxy S25',      'Day in my life con Samsung Galaxy S25, natural integration, non sembrare pub', true, false),
    (camp_samsung, a_elisa, 'Instagram Post', '2026-04-01', 'Post finale campagna Galaxy',        NULL, false, false);

  -- --------------------------------------------------------
  -- NOTIFICATIONS (8 unread)
  -- --------------------------------------------------------
  INSERT INTO public.notifications (agency_id, type, title, message, severity, is_read, related_entity_type, related_entity_id, created_at)
  VALUES
    (aid_agency, 'deadline',     'Scadenza contratto Armani Beauty',    'Contratto Armani Beauty di Beatrice Conforti in scadenza il 31/05/2026 — avvia rinnovo.',                'high',   false, 'contract', c_bea_armani,    now() - interval '1 day'),
    (aid_agency, 'conflict',     'Conflitto esclusività L''Oréal/Garnier', 'Conflitto esclusività L''Oréal/Garnier rilevato per Chiara Romano — azione richiesta.',              'high',   false, 'conflict', conf_loreal,     now() - interval '2 days'),
    (aid_agency, 'deadline',     'Scadenza Gucci Beauty',               'Contratto Gucci Beauty di Sofia Marchetti scade tra 28 giorni.',                                         'medium', false, 'contract', c_sofia_gucci,   now() - interval '1 day'),
    (aid_agency, 'conflict',     'Potenziale conflitto Mercedes/Maserati', 'Deal Mercedes-Benz potenzialmente in conflitto con esclusiva Maserati (Beatrice Conforti).',          'medium', false, 'deal',     dl_merc,         now() - interval '3 days'),
    (aid_agency, 'deliverable',  'Reel Zalando non approvato',          'Deliverable Reel Zalando di Sofia non ancora approvato — scadenza 01/04.',                                'medium', false, 'campaign', camp_zalando,    now() - interval '2 days'),
    (aid_agency, 'deal',         'Deal Rolex in inbound',               'Deal Rolex / Beatrice Conforti in inbound — valutare priorità.',                                         'low',    false, 'deal',     dl_rolex,        now() - interval '2 days'),
    (aid_agency, 'deadline',     'Scadenza Booking.com',                'Contratto Booking.com di Giulia Ferrari scade tra 45 giorni.',                                           'low',    false, 'contract', c_giulia_booking, now() - interval '4 days'),
    (aid_agency, 'deal',         'Nuovo deal Emirates',                 'Nuovo deal Emirates in pipeline per Giulia Ferrari.',                                                     'low',    false, 'deal',     dl_emirates,     now() - interval '5 days')
  ON CONFLICT DO NOTHING;

  -- --------------------------------------------------------
  -- ACTIVITIES (10 recent)
  -- --------------------------------------------------------
  INSERT INTO public.activities (agency_id, athlete_id, contract_id, deal_id, activity_type, description, created_at)
  VALUES
    (aid_agency, a_beatrice,   c_bea_armani,    NULL,        'contract_uploaded',    'Contratto Armani Beauty caricato e indicizzato per Beatrice Conforti.',       now() - interval '1 day'),
    (aid_agency, a_beatrice,   NULL,            dl_rolex,    'deal_created',         'Nuovo deal Rolex (€120.000) creato per Beatrice Conforti — inbound.',        now() - interval '2 days'),
    (aid_agency, a_chiara,     c_chiara_loreal, NULL,        'conflict_detected',    'Conflitto esclusività rilevato: L''Oréal Paris vs Garnier per Chiara Romano.', now() - interval '3 days'),
    (aid_agency, a_sofia,      NULL,            NULL,        'campaign_created',     'Campagna Zalando Spring Collection 2026 aggiornata — 4/6 deliverable completati.', now() - interval '4 days'),
    (aid_agency, a_giulia,     NULL,            dl_emirates, 'deal_stage_changed',   'Deal Emirates per Giulia Ferrari avanzato a qualified.',                      now() - interval '6 days'),
    (aid_agency, a_elisa,      c_elisa_samsung, NULL,        'contract_uploaded',    'Contratto Samsung Italia caricato per Elisa Martini.',                        now() - interval '8 days'),
    (aid_agency, a_beatrice,   NULL,            dl_merc,     'deal_created',         'Nuovo deal Mercedes-Benz (€180.000) creato per Beatrice Conforti — negotiation.', now() - interval '10 days'),
    (aid_agency, a_chiara,     NULL,            NULL,        'campaign_created',     'Deliverable Reel L''Oréal approvato per Chiara Romano.',                     now() - interval '12 days'),
    (aid_agency, a_luca,       NULL,            dl_hublot,   'deal_stage_changed',   'Deal Hublot per Luca Barone avanzato a negotiation (€45.000).',              now() - interval '15 days'),
    (aid_agency, a_valentina,  c_vale_myprot,   NULL,        'conflict_detected',    'Potenziale conflitto rilevato: MyProtein vs Optimum Nutrition per Valentina Esposito.', now() - interval '18 days')
  ON CONFLICT DO NOTHING;

END $$;
