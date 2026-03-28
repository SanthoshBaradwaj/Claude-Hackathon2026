-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS (anonymous sessions)
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  session_id      TEXT NOT NULL UNIQUE,
  age_band        TEXT,          -- '18-24', '25-34', '35-44', '45-54', '55+'
  gender          TEXT,
  location        TEXT,
  pronouns        TEXT,
  responses_count INTEGER DEFAULT 0,
  is_unlocked     BOOLEAN DEFAULT FALSE
);

-- ============================================================
-- ARTICLES (ingested from news API)
-- ============================================================
CREATE TABLE articles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  headline        TEXT NOT NULL,
  description     TEXT,
  source          TEXT,
  published_at    TIMESTAMPTZ,
  image_url       TEXT,
  article_url     TEXT NOT NULL,
  category        TEXT,
  ingested_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROMPTS (Claude-generated from articles)
-- ============================================================
CREATE TABLE prompts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id          UUID REFERENCES articles(id) ON DELETE CASCADE,
  balanced_prompt     TEXT NOT NULL,
  specific_prompt     TEXT,
  emotional_prompt    TEXT,
  factual_prompt      TEXT,
  safety_category     TEXT DEFAULT 'safe',    -- 'safe', 'sensitive', 'flagged'
  neutral_summary     TEXT NOT NULL,
  active_prompt_type  TEXT DEFAULT 'balanced', -- which variant to display
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RESPONSES (user opinions)
-- ============================================================
CREATE TABLE responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  prompt_id       UUID REFERENCES prompts(id) ON DELETE CASCADE,
  raw_text        TEXT NOT NULL,
  input_method    TEXT DEFAULT 'text',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, prompt_id)  -- one response per user per prompt
);

-- ============================================================
-- EXTRACTED_FACTORS (Claude-generated semantic features)
-- ============================================================
CREATE TABLE extracted_factors (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  response_id         UUID REFERENCES responses(id) ON DELETE CASCADE UNIQUE,
  stance              FLOAT NOT NULL,       -- [-1.0, 1.0]
  sentiment           FLOAT NOT NULL,       -- [-1.0, 1.0]
  emotion             TEXT NOT NULL,
  certainty           FLOAT NOT NULL,       -- [0.0, 1.0]
  primary_concern     TEXT NOT NULL,
  primary_value       TEXT NOT NULL,
  trust_level         FLOAT NOT NULL,       -- [0.0, 1.0]
  urgency             FLOAT NOT NULL,       -- [0.0, 1.0]
  policy_preference   TEXT,
  normalized_summary  TEXT NOT NULL,
  keywords            TEXT[] DEFAULT '{}',
  feature_vector      FLOAT[] DEFAULT '{}'  -- encoded numerical vector for clustering
);

-- ============================================================
-- CLUSTERS (K-Means output per prompt)
-- ============================================================
CREATE TABLE clusters (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id               UUID REFERENCES prompts(id) ON DELETE CASCADE,
  cluster_index           INTEGER NOT NULL,
  label                   TEXT NOT NULL,       -- 'Cautious Skeptics', etc.
  centroid                FLOAT[] DEFAULT '{}',
  member_count            INTEGER DEFAULT 0,
  percentage              FLOAT DEFAULT 0,
  representative_summary  TEXT,
  computed_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER_CLUSTER_ASSIGNMENTS (which cluster each response falls in)
-- ============================================================
CREATE TABLE user_cluster_assignments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID REFERENCES users(id) ON DELETE CASCADE,
  response_id           UUID REFERENCES responses(id) ON DELETE CASCADE,
  cluster_id            UUID REFERENCES clusters(id) ON DELETE CASCADE,
  distance_to_centroid  FLOAT
);

-- ============================================================
-- INDEXES for common queries
-- ============================================================
CREATE INDEX idx_prompts_article_id ON prompts(article_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_responses_prompt_id ON responses(prompt_id);
CREATE INDEX idx_extracted_factors_response_id ON extracted_factors(response_id);
CREATE INDEX idx_clusters_prompt_id ON clusters(prompt_id);
CREATE INDEX idx_user_cluster_assignments_user_id ON user_cluster_assignments(user_id);

-- ============================================================
-- ROW-LEVEL SECURITY (basic — allows anon access for MVP)
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_cluster_assignments ENABLE ROW LEVEL SECURITY;

-- Permissive policies for MVP (tighten for production)
CREATE POLICY "Allow all for users"          ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for articles"       ON articles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for prompts"        ON prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for responses"      ON responses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for factors"        ON extracted_factors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for clusters"       ON clusters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for assignments"    ON user_cluster_assignments FOR ALL USING (true) WITH CHECK (true);
