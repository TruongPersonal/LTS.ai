CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS lts_ai;

GRANT USAGE ON SCHEMA lts_ai TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai GRANT ALL ON TABLES TO service_role;

CREATE TABLE IF NOT EXISTS lts_ai.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    daily_processed_seconds INT NOT NULL DEFAULT 0,
    last_processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lts_ai.profiles ADD COLUMN IF NOT EXISTS plan TEXT;
UPDATE lts_ai.profiles SET plan = 'free' WHERE plan IS NULL;
ALTER TABLE lts_ai.profiles ALTER COLUMN plan SET DEFAULT 'free';
ALTER TABLE lts_ai.profiles ALTER COLUMN plan SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_plan_allowed'
      AND conrelid = 'lts_ai.profiles'::regclass
  ) THEN
    ALTER TABLE lts_ai.profiles
      ADD CONSTRAINT profiles_plan_allowed CHECK (plan IN ('free', 'pro', 'max'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS lts_ai.projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES lts_ai.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_language TEXT NOT NULL CHECK (target_language IN ('vi', 'en', 'zh', 'ja', 'ko', 'fr', 'it')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lts_ai.files_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES lts_ai.projects(id) ON DELETE CASCADE,
    drive_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    detected_source_lang TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'processing', 'completed', 'failed')),
    input_source TEXT NOT NULL DEFAULT 'media' CHECK (input_source IN ('media', 'existing_subtitle')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lts_ai.subtitles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES lts_ai.files_media(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(file_id, language)
);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON lts_ai.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_files_media_project_id ON lts_ai.files_media(project_id);
CREATE INDEX IF NOT EXISTS idx_subtitles_file_id ON lts_ai.subtitles(file_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lts_ai TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA lts_ai TO service_role;

ALTER TABLE lts_ai.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.files_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.subtitles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON lts_ai.profiles;
CREATE POLICY "Users can manage own profile" ON lts_ai.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can manage own projects" ON lts_ai.projects;
CREATE POLICY "Users can manage own projects" ON lts_ai.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own media files" ON lts_ai.files_media;
CREATE POLICY "Users can manage own media files" ON lts_ai.files_media
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lts_ai.projects WHERE projects.id = files_media.project_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lts_ai.projects WHERE projects.id = files_media.project_id AND projects.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage own subtitles" ON lts_ai.subtitles;
CREATE POLICY "Users can manage own subtitles" ON lts_ai.subtitles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM lts_ai.files_media JOIN lts_ai.projects ON projects.id = files_media.project_id WHERE files_media.id = subtitles.file_id AND projects.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM lts_ai.files_media JOIN lts_ai.projects ON projects.id = files_media.project_id WHERE files_media.id = subtitles.file_id AND projects.user_id = auth.uid())
  );
