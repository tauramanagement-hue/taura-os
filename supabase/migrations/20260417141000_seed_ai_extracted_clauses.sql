-- Seed ai_extracted_clauses JSONB on existing contracts where it is NULL.
-- Realistic Italian sport/influencer contract clause structure, rotated over
-- an 8-variant pool so contracts don't all look identical.
-- Idempotent: only populates rows where ai_extracted_clauses IS NULL.
--
-- Structure of the JSONB payload:
-- {
--   "exclusivity": {
--     "category": "bevande analcoliche",
--     "territory": "Italia",
--     "competitor_brands": ["Coca-Cola", "Pepsi"]
--   },
--   "obligations": [
--     "1 post IG feed/mese branded",
--     "2 stories/settimana",
--     "1 evento fisico trimestrale"
--   ],
--   "penalties": {
--     "breach_amount_eur": 25000,
--     "breach_description": "In caso di violazione esclusività ex art. 4",
--     "late_delivery_eur_per_day": 500
--   },
--   "image_rights": {
--     "granted": true,
--     "territory": "mondo",
--     "duration_months": 24,
--     "media": ["social", "OOH", "stampa", "digital"]
--   },
--   "renewal": {
--     "auto_renew": false,
--     "notice_days": 90,
--     "renewal_window_days": 180
--   },
--   "termination": {
--     "notice_days": 60,
--     "material_breach_cure_days": 15,
--     "foro_competente": "Milano"
--   },
--   "payment": {
--     "schedule": "trimestrale",
--     "net_days": 60
--   },
--   "non_compete_months_post": 6
-- }

DO $$
DECLARE
  variants jsonb[] := ARRAY[
    -- Variant 1: esclusiva bevande, penale alta, diritti immagine lunghi
    '{
      "exclusivity": {"category": "bevande analcoliche", "territory": "Italia", "competitor_brands": ["Coca-Cola", "Pepsi", "Fanta"]},
      "obligations": ["1 post IG feed/mese branded", "2 stories/settimana con tag @brand", "1 evento fisico trimestrale", "Partecipazione shooting annuale (3 giorni)"],
      "penalties": {"breach_amount_eur": 50000, "breach_description": "In caso di violazione esclusività o uso di prodotto concorrente", "late_delivery_eur_per_day": 500},
      "image_rights": {"granted": true, "territory": "mondo", "duration_months": 36, "media": ["social", "OOH", "stampa", "digital", "TV"]},
      "renewal": {"auto_renew": false, "notice_days": 90, "renewal_window_days": 180},
      "termination": {"notice_days": 60, "material_breach_cure_days": 15, "foro_competente": "Milano"},
      "payment": {"schedule": "trimestrale anticipato", "net_days": 30},
      "non_compete_months_post": 6
    }'::jsonb,

    -- Variant 2: esclusiva abbigliamento sportivo
    '{
      "exclusivity": {"category": "abbigliamento sportivo", "territory": "EU", "competitor_brands": ["Nike", "Adidas", "Puma", "Under Armour"]},
      "obligations": ["Indossare brand in gara", "4 post IG reel/trimestre", "1 clinic annuale con fan", "Collaborazione product design 1/anno"],
      "penalties": {"breach_amount_eur": 100000, "breach_description": "Uso pubblico prodotto concorrente in ambito sportivo", "late_delivery_eur_per_day": 1000},
      "image_rights": {"granted": true, "territory": "mondo", "duration_months": 24, "media": ["social", "retail", "packaging", "digital"]},
      "renewal": {"auto_renew": true, "notice_days": 120, "renewal_window_days": 365},
      "termination": {"notice_days": 90, "material_breach_cure_days": 30, "foro_competente": "Milano"},
      "payment": {"schedule": "semestrale", "net_days": 45},
      "non_compete_months_post": 12
    }'::jsonb,

    -- Variant 3: influencer beauty, non esclusivo
    '{
      "exclusivity": {"category": null, "territory": null, "competitor_brands": []},
      "obligations": ["3 post IG/mese sponsored", "4 stories/mese", "1 TikTok video", "Menzione in 1 intervista"],
      "penalties": {"breach_amount_eur": 10000, "breach_description": "Mancata consegna deliverable contrattuali", "late_delivery_eur_per_day": 200},
      "image_rights": {"granted": true, "territory": "Italia", "duration_months": 12, "media": ["social", "digital"]},
      "renewal": {"auto_renew": false, "notice_days": 30, "renewal_window_days": 60},
      "termination": {"notice_days": 30, "material_breach_cure_days": 10, "foro_competente": "Milano"},
      "payment": {"schedule": "mensile", "net_days": 60},
      "non_compete_months_post": 0
    }'::jsonb,

    -- Variant 4: ambassador automotive
    '{
      "exclusivity": {"category": "automotive", "territory": "Italia", "competitor_brands": ["BMW", "Audi", "Mercedes-Benz", "Ferrari"]},
      "obligations": ["Uso veicolo brand in pubblico", "2 apparizioni PR/anno", "1 shooting annuale", "Esclusività brand in categoria auto"],
      "penalties": {"breach_amount_eur": 150000, "breach_description": "Uso o promozione veicoli di brand concorrenti", "late_delivery_eur_per_day": 1500},
      "image_rights": {"granted": true, "territory": "mondo", "duration_months": 36, "media": ["social", "OOH", "TV", "stampa", "digital"]},
      "renewal": {"auto_renew": false, "notice_days": 120, "renewal_window_days": 240},
      "termination": {"notice_days": 90, "material_breach_cure_days": 30, "foro_competente": "Milano"},
      "payment": {"schedule": "annuale anticipato", "net_days": 30},
      "non_compete_months_post": 12
    }'::jsonb,

    -- Variant 5: testimonial energy drink
    '{
      "exclusivity": {"category": "energy drink", "territory": "EU", "competitor_brands": ["Red Bull", "Monster", "Rockstar", "Burn"]},
      "obligations": ["Uso prodotto in training documentato", "3 post IG/mese", "1 evento brand/trimestre", "Disponibilità interviste brand"],
      "penalties": {"breach_amount_eur": 75000, "breach_description": "Uso o endorsement prodotti concorrenti", "late_delivery_eur_per_day": 750},
      "image_rights": {"granted": true, "territory": "EU", "duration_months": 24, "media": ["social", "packaging", "digital", "retail"]},
      "renewal": {"auto_renew": false, "notice_days": 90, "renewal_window_days": 180},
      "termination": {"notice_days": 60, "material_breach_cure_days": 20, "foro_competente": "Milano"},
      "payment": {"schedule": "trimestrale", "net_days": 45},
      "non_compete_months_post": 9
    }'::jsonb,

    -- Variant 6: sponsorship tecnologia/gaming
    '{
      "exclusivity": {"category": "tecnologia gaming", "territory": "mondo", "competitor_brands": ["Razer", "Logitech G", "SteelSeries"]},
      "obligations": ["Uso setup brand in streaming", "Partecipazione eventi esports", "2 contenuti YouTube/mese", "Co-branded merch 2/anno"],
      "penalties": {"breach_amount_eur": 40000, "breach_description": "Uso pubblico hardware concorrente in streaming", "late_delivery_eur_per_day": 400},
      "image_rights": {"granted": true, "territory": "mondo", "duration_months": 18, "media": ["social", "digital", "streaming platforms"]},
      "renewal": {"auto_renew": true, "notice_days": 60, "renewal_window_days": 90},
      "termination": {"notice_days": 45, "material_breach_cure_days": 15, "foro_competente": "Milano"},
      "payment": {"schedule": "mensile", "net_days": 30},
      "non_compete_months_post": 3
    }'::jsonb,

    -- Variant 7: mandato agenzia (interno Taura)
    '{
      "exclusivity": {"category": "rappresentanza commerciale", "territory": "mondo", "competitor_brands": []},
      "obligations": ["Mandato esclusivo di rappresentanza", "Approvazione preventiva di ogni deal brand", "Report trimestrale attività", "Clausola non-sollecitazione"],
      "penalties": {"breach_amount_eur": 100000, "breach_description": "Firma di deal brand senza intermediazione agenzia", "late_delivery_eur_per_day": 0},
      "image_rights": {"granted": false, "territory": null, "duration_months": 0, "media": []},
      "renewal": {"auto_renew": true, "notice_days": 180, "renewal_window_days": 365},
      "termination": {"notice_days": 120, "material_breach_cure_days": 30, "foro_competente": "Milano"},
      "payment": {"schedule": "commissione su singolo deal", "net_days": 30},
      "non_compete_months_post": 12
    }'::jsonb,

    -- Variant 8: partnership food/nutrition
    '{
      "exclusivity": {"category": "nutrition/integratori", "territory": "EU", "competitor_brands": ["MyProtein", "Optimum Nutrition", "BioTech USA"]},
      "obligations": ["Consumo prodotti documentato", "2 post IG/mese con codice sconto", "1 collaborazione formula prodotto", "Eventi brand 1/anno"],
      "penalties": {"breach_amount_eur": 30000, "breach_description": "Endorsement pubblico di competitor nutrition", "late_delivery_eur_per_day": 300},
      "image_rights": {"granted": true, "territory": "EU", "duration_months": 18, "media": ["social", "packaging", "digital", "retail"]},
      "renewal": {"auto_renew": false, "notice_days": 60, "renewal_window_days": 120},
      "termination": {"notice_days": 45, "material_breach_cure_days": 15, "foro_competente": "Milano"},
      "payment": {"schedule": "trimestrale", "net_days": 45},
      "non_compete_months_post": 6
    }'::jsonb
  ];
  r RECORD;
  idx INTEGER := 0;
BEGIN
  FOR r IN
    SELECT id, contract_type, exclusivity_category
    FROM public.contracts
    WHERE ai_extracted_clauses IS NULL
    ORDER BY created_at
    LIMIT 30
  LOOP
    UPDATE public.contracts
    SET ai_extracted_clauses = variants[(idx % array_length(variants, 1)) + 1]
    WHERE id = r.id;
    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Seeded ai_extracted_clauses on % contracts', idx;
END $$;
