/*
  # Add social_enriched_at to athletes table

  ## Summary
  Adds a `social_enriched_at` timestamp column to the athletes table to track
  when social stats were last enriched via AI. This enables rate limiting on
  the enrich-social feature (e.g., prevent re-enrichment within 7 days).

  ## Changes
  - `athletes` table: new `social_enriched_at` column (timestamptz, nullable)

  ## Notes
  - Nullable by default; null means never enriched
  - Frontend can check this to show "Aggiorna" button only after 7 days
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'athletes' AND column_name = 'social_enriched_at'
  ) THEN
    ALTER TABLE athletes ADD COLUMN social_enriched_at timestamptz;
  END IF;
END $$;
