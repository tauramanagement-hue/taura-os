/*
  # Add Agency Type System & Sport-Specific Tables

  ## Changes
  
  1. Agency Type Field
    - Add `agency_type` to agencies table ('talent' or 'sport')
    - Default to 'talent' for existing agencies
  
  2. Transfer Windows Table
    - Static reference table for transfer windows by country/league
    - Fields: country, league, window_type, opens_at, closes_at, season
  
  3. Transfers Table
    - Track transfer negotiations and deals
    - Links to athletes, transfer windows
    - Fields: from_club, to_club, type, status, fees, commissions
  
  4. Mandates Table
    - Track FIGC/FIFA mandates for sport agencies
    - Fields: federation, type, dates, deposit status, commissions
  
  5. Scouting Prospects Table
    - Pipeline for recruiting new athletes
    - Fields: name, club, stage, priority, contract expiry
  
  6. Security
    - Enable RLS on all new tables
    - Add policies for agency-scoped access
*/

-- Add agency_type to agencies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agencies' AND column_name = 'agency_type'
  ) THEN
    ALTER TABLE agencies ADD COLUMN agency_type text DEFAULT 'talent';
  END IF;
END $$;

-- Transfer Windows (static reference data)
CREATE TABLE IF NOT EXISTS transfer_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  league text NOT NULL,
  window_type text NOT NULL,
  opens_at date NOT NULL,
  closes_at date NOT NULL,
  season text NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transfer_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Transfer windows are public"
  ON transfer_windows FOR SELECT
  TO authenticated
  USING (true);

-- Transfers
CREATE TABLE IF NOT EXISTS transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) NOT NULL,
  athlete_id uuid REFERENCES athletes(id) NOT NULL,
  from_club text,
  to_club text,
  transfer_type text NOT NULL,
  status text DEFAULT 'scouting',
  estimated_fee numeric,
  commission_pct numeric,
  commission_amount numeric,
  commission_status text DEFAULT 'pending',
  target_window_id uuid REFERENCES transfer_windows(id),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agency transfers"
  ON transfers FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own agency transfers"
  ON transfers FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agency transfers"
  ON transfers FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own agency transfers"
  ON transfers FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Mandates
CREATE TABLE IF NOT EXISTS mandates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) NOT NULL,
  athlete_id uuid REFERENCES athletes(id) NOT NULL,
  federation text NOT NULL,
  mandate_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  deposited boolean DEFAULT false,
  deposit_date date,
  deposit_fee_paid boolean DEFAULT false,
  commission_type text,
  commission_value numeric,
  commission_payer text,
  exclusive boolean DEFAULT true,
  status text DEFAULT 'active',
  notes text,
  file_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mandates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agency mandates"
  ON mandates FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own agency mandates"
  ON mandates FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agency mandates"
  ON mandates FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own agency mandates"
  ON mandates FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Scouting Prospects
CREATE TABLE IF NOT EXISTS scouting_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid REFERENCES agencies(id) NOT NULL,
  full_name text NOT NULL,
  date_of_birth date,
  nationality text,
  current_club text,
  current_league text,
  position text,
  sport text NOT NULL,
  stage text DEFAULT 'observed',
  priority text DEFAULT 'medium',
  source text,
  notes text,
  instagram_handle text,
  tiktok_handle text,
  video_url text,
  contract_expires date,
  estimated_value numeric,
  assigned_to uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scouting_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agency prospects"
  ON scouting_prospects FOR SELECT
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own agency prospects"
  ON scouting_prospects FOR INSERT
  TO authenticated
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update own agency prospects"
  ON scouting_prospects FOR UPDATE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own agency prospects"
  ON scouting_prospects FOR DELETE
  TO authenticated
  USING (
    agency_id IN (
      SELECT agency_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Seed transfer windows data
INSERT INTO transfer_windows (country, league, window_type, opens_at, closes_at, season) VALUES
('Italia', 'Serie A', 'winter', '2026-01-03', '2026-02-02', '2025/26'),
('Italia', 'Serie A', 'summer', '2026-07-01', '2026-08-31', '2025/26'),
('Inghilterra', 'Premier League', 'winter', '2026-01-01', '2026-02-02', '2025/26'),
('Inghilterra', 'Premier League', 'summer', '2026-06-10', '2026-08-31', '2025/26'),
('Spagna', 'La Liga', 'winter', '2026-01-01', '2026-02-02', '2025/26'),
('Spagna', 'La Liga', 'summer', '2026-07-01', '2026-08-31', '2025/26'),
('Germania', 'Bundesliga', 'winter', '2026-01-01', '2026-02-02', '2025/26'),
('Germania', 'Bundesliga', 'summer', '2026-07-01', '2026-08-31', '2025/26'),
('Francia', 'Ligue 1', 'winter', '2026-01-01', '2026-02-02', '2025/26'),
('Francia', 'Ligue 1', 'summer', '2026-07-01', '2026-08-31', '2025/26'),
('Arabia Saudita', 'Saudi Pro League', 'winter', '2026-01-01', '2026-02-02', '2025/26'),
('Arabia Saudita', 'Saudi Pro League', 'summer', '2026-07-17', '2026-10-01', '2025/26')
ON CONFLICT DO NOTHING;