-- Add demographic columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS selected_categories TEXT[] DEFAULT '{}';

-- Category adjacency map for the minimum floor logic (stored as reference)
-- Technology ↔ Business, Climate ↔ Health, Business ↔ Technology,
-- Health ↔ Climate, Sports ↔ Health

-- Add demographic snapshot to responses so we can slice clusters
-- even if user later changes their profile
ALTER TABLE responses
  ADD COLUMN IF NOT EXISTS age_band_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS occupation_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS education_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS location_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS gender_snapshot TEXT;

-- Demographic breakdown table — precomputed per cluster per dimension
CREATE TABLE IF NOT EXISTS cluster_demographic_breakdowns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL,  -- 'age_band' | 'occupation' | 'education' | 'location' | 'gender'
  dimension_value TEXT NOT NULL,
  count INTEGER DEFAULT 0,
  percentage FLOAT DEFAULT 0,
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breakdown_cluster_id
  ON cluster_demographic_breakdowns(cluster_id);
CREATE INDEX IF NOT EXISTS idx_breakdown_dimension
  ON cluster_demographic_breakdowns(cluster_id, dimension);

CREATE POLICY "Allow all for breakdowns"
  ON cluster_demographic_breakdowns FOR ALL USING (true) WITH CHECK (true);
ALTER TABLE cluster_demographic_breakdowns ENABLE ROW LEVEL SECURITY;
