CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS lts_ai;

-- Bootstrap the first admin manually after the account profile exists:
-- UPDATE lts_ai.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';

GRANT USAGE ON SCHEMA lts_ai TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai GRANT ALL ON TABLES TO service_role;

CREATE TABLE IF NOT EXISTS lts_ai.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user' CONSTRAINT profiles_role_allowed CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'free' CONSTRAINT profiles_plan_allowed CHECK (plan IN ('free', 'pro', 'max')),
    daily_processed_seconds INT NOT NULL DEFAULT 0,
    last_processed_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lts_ai.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE lts_ai.profiles ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE lts_ai.profiles SET role = 'user' WHERE role IS NULL;
ALTER TABLE lts_ai.profiles ALTER COLUMN role SET DEFAULT 'user';
ALTER TABLE lts_ai.profiles ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_allowed'
      AND conrelid = 'lts_ai.profiles'::regclass
  ) THEN
    ALTER TABLE lts_ai.profiles
      ADD CONSTRAINT profiles_role_allowed CHECK (role IN ('user', 'admin'));
  END IF;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor ON lts_ai.admin_audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON lts_ai.admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON lts_ai.admin_audit_log(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA lts_ai TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA lts_ai TO service_role;

REVOKE INSERT, UPDATE, DELETE ON lts_ai.profiles FROM authenticated;
GRANT SELECT ON lts_ai.profiles TO authenticated;
GRANT INSERT (id, email, full_name) ON lts_ai.profiles TO authenticated;
GRANT UPDATE (id, email, full_name) ON lts_ai.profiles TO authenticated;
REVOKE ALL ON lts_ai.admin_audit_log FROM authenticated;

ALTER TABLE lts_ai.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.files_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can create own basic profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can update own basic profile" ON lts_ai.profiles;
CREATE POLICY "Users can read own profile" ON lts_ai.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can create own basic profile" ON lts_ai.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own basic profile" ON lts_ai.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

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

CREATE TABLE IF NOT EXISTS lts_ai.processing_quota_reservations (
    file_id UUID PRIMARY KEY REFERENCES lts_ai.files_media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lts_ai.profiles(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    reserved_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processing_quota_reservations_user
    ON lts_ai.processing_quota_reservations(user_id);

ALTER TABLE lts_ai.processing_quota_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lts_ai.processing_quota_reservations FROM authenticated;
GRANT ALL ON lts_ai.processing_quota_reservations TO service_role;

CREATE OR REPLACE FUNCTION lts_ai.reserve_processing_quota(
    p_file_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    caller_id UUID := auth.uid();
    today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
    file_duration INTEGER;
    profile_plan TEXT;
    profile_used INTEGER;
    profile_date DATE;
    daily_limit INTEGER;
    effective_used INTEGER;
    existing_duration INTEGER;
    existing_date DATE;
    reservation_exists BOOLEAN := false;
BEGIN
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT files_media.duration_seconds
    INTO file_duration
    FROM lts_ai.files_media
    JOIN lts_ai.projects ON projects.id = files_media.project_id
    WHERE files_media.id = p_file_id
      AND projects.user_id = caller_id
    FOR UPDATE OF files_media;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'File was not found or is inaccessible.'
            USING ERRCODE = 'P0002';
    END IF;

    IF file_duration IS NULL OR file_duration <= 0 THEN
        RAISE EXCEPTION 'File duration is required before processing.'
            USING ERRCODE = '22023';
    END IF;

    SELECT duration_seconds, reserved_date
    INTO existing_duration, existing_date
    FROM lts_ai.processing_quota_reservations
    WHERE file_id = p_file_id
    FOR UPDATE;

    IF FOUND AND existing_date = today_utc THEN
        RETURN jsonb_build_object(
            'reserved', true,
            'already_reserved', true,
            'duration_seconds', existing_duration,
            'reserved_date', existing_date
        );
    END IF;

    reservation_exists := FOUND;

    SELECT plan, daily_processed_seconds, last_processed_date
    INTO profile_plan, profile_used, profile_date
    FROM lts_ai.profiles
    WHERE id = caller_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    daily_limit := CASE profile_plan
        WHEN 'pro' THEN 1800
        WHEN 'max' THEN 3600
        ELSE 600
    END;
    effective_used := CASE
        WHEN profile_date = today_utc THEN GREATEST(COALESCE(profile_used, 0), 0)
        ELSE 0
    END;

    IF effective_used + file_duration > daily_limit THEN
        RAISE EXCEPTION 'Daily processing quota exceeded.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE lts_ai.profiles
    SET
        daily_processed_seconds = effective_used + file_duration,
        last_processed_date = today_utc
    WHERE id = caller_id;

    IF reservation_exists THEN
        UPDATE lts_ai.processing_quota_reservations
        SET
            duration_seconds = file_duration,
            reserved_date = today_utc
        WHERE file_id = p_file_id;
    ELSE
        INSERT INTO lts_ai.processing_quota_reservations (
            file_id,
            user_id,
            duration_seconds,
            reserved_date
        )
        VALUES (
            p_file_id,
            caller_id,
            file_duration,
            today_utc
        );
    END IF;

    RETURN jsonb_build_object(
        'reserved', true,
        'already_reserved', false,
        'duration_seconds', file_duration,
        'reserved_date', today_utc
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.reserve_processing_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lts_ai.reserve_processing_quota(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION lts_ai.complete_processing_quota(
    p_file_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    caller_id UUID := auth.uid();
BEGIN
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.'
            USING ERRCODE = '42501';
    END IF;

    DELETE FROM lts_ai.processing_quota_reservations
    WHERE file_id = p_file_id
      AND user_id = caller_id;
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.complete_processing_quota(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lts_ai.complete_processing_quota(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION lts_ai.admin_set_user_plan(
    p_target_user_id UUID,
    p_new_plan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    actor_id UUID := auth.uid();
    previous_plan TEXT;
    changed_at TIMESTAMPTZ := NOW();
BEGIN
    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM lts_ai.profiles
        WHERE id = actor_id
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Admin permission is required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_new_plan NOT IN ('free', 'pro', 'max') THEN
        RAISE EXCEPTION 'Invalid plan.'
            USING ERRCODE = '22023';
    END IF;

    SELECT plan
    INTO previous_plan
    FROM lts_ai.profiles
    WHERE id = p_target_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target profile was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    UPDATE lts_ai.profiles
    SET plan = p_new_plan
    WHERE id = p_target_user_id;

    INSERT INTO lts_ai.admin_audit_log (
        actor_user_id,
        target_user_id,
        action,
        old_value,
        new_value,
        created_at
    )
    VALUES (
        actor_id,
        p_target_user_id,
        'set_plan',
        jsonb_build_object('plan', previous_plan),
        jsonb_build_object('plan', p_new_plan),
        changed_at
    );

    RETURN jsonb_build_object(
        'target_user_id', p_target_user_id,
        'previous_plan', previous_plan,
        'plan', p_new_plan,
        'changed_at', changed_at
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.admin_set_user_plan(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lts_ai.admin_set_user_plan(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
-- The Edge Function is the only caller of the service-role-only functions below.

ALTER TABLE lts_ai.files_media
  ADD COLUMN IF NOT EXISTS processing_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS processing_last_activity_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lts_ai.processing_chunk_claims (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_id UUID NOT NULL REFERENCES lts_ai.files_media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES lts_ai.profiles(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    chunk_start_seconds INTEGER NOT NULL CHECK (chunk_start_seconds >= 0),
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, attempt_id, chunk_index),
    UNIQUE (file_id, attempt_id, chunk_start_seconds)
);

CREATE INDEX IF NOT EXISTS idx_processing_chunk_claims_user
    ON lts_ai.processing_chunk_claims(user_id);

CREATE INDEX IF NOT EXISTS idx_processing_chunk_claims_file_attempt
    ON lts_ai.processing_chunk_claims(file_id, attempt_id);

ALTER TABLE lts_ai.processing_chunk_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON lts_ai.processing_chunk_claims FROM authenticated;
GRANT ALL ON lts_ai.processing_chunk_claims TO service_role;

-- A user may only submit metadata needed to create a file and rename it later.
-- Processing state, source identity and measured duration are backend-owned.
REVOKE INSERT, UPDATE ON lts_ai.files_media FROM authenticated;
GRANT INSERT (
    project_id,
    drive_file_id,
    file_name,
    mime_type,
    input_source,
    detected_source_lang
)
ON lts_ai.files_media
TO authenticated;
GRANT UPDATE (file_name)
ON lts_ai.files_media
TO authenticated;

-- The old client-callable quota functions must not remain an enforcement bypass.
REVOKE ALL ON FUNCTION lts_ai.reserve_processing_quota(UUID) FROM PUBLIC, authenticated;
REVOKE ALL ON FUNCTION lts_ai.complete_processing_quota(UUID) FROM PUBLIC, authenticated;

CREATE OR REPLACE FUNCTION lts_ai.start_processing_attempt(
    p_user_id UUID,
    p_file_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    file_status TEXT;
    file_input_source TEXT;
    attempt_id UUID := uuid_generate_v4();
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User identity is required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT f.status, f.input_source
    INTO file_status, file_input_source
    FROM lts_ai.files_media AS f
    JOIN lts_ai.projects AS p ON p.id = f.project_id
    WHERE f.id = p_file_id
      AND p.user_id = p_user_id
    FOR UPDATE OF f;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'File was not found or is inaccessible.'
            USING ERRCODE = 'P0002';
    END IF;

    IF file_input_source <> 'media' THEN
        RAISE EXCEPTION 'This file does not require media transcription.'
            USING ERRCODE = '22023';
    END IF;

    IF file_status NOT IN ('draft', 'failed', 'queued') THEN
        RAISE EXCEPTION 'This file is not ready to start processing.'
            USING ERRCODE = 'P0004';
    END IF;

    UPDATE lts_ai.files_media
    SET
        processing_attempt_id = attempt_id,
        status = 'processing',
        processing_last_activity_at = NOW(),
        error_message = NULL
    WHERE id = p_file_id;

    RETURN jsonb_build_object(
        'started', true,
        'attempt_id', attempt_id
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.start_processing_attempt(UUID, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.start_processing_attempt(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION lts_ai.claim_processing_chunk(
    p_user_id UUID,
    p_file_id UUID,
    p_attempt_id UUID,
    p_chunk_index INTEGER,
    p_chunk_start_seconds INTEGER,
    p_duration_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    file_attempt_id UUID;
    file_status TEXT;
    file_input_source TEXT;
    profile_plan TEXT;
    profile_used INTEGER;
    profile_date DATE;
    daily_limit INTEGER;
    effective_used INTEGER;
    today_utc DATE := (NOW() AT TIME ZONE 'UTC')::DATE;
BEGIN
    IF p_user_id IS NULL OR p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'User identity and processing attempt are required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_chunk_index IS NULL OR p_chunk_index < 0
       OR p_chunk_start_seconds IS NULL OR p_chunk_start_seconds < 0
       OR p_chunk_start_seconds <> p_chunk_index::BIGINT * 420
       OR p_duration_seconds IS NULL OR p_duration_seconds <= 0
       OR p_duration_seconds > 420 THEN
        RAISE EXCEPTION 'Invalid processing chunk.'
            USING ERRCODE = '22023';
    END IF;

    SELECT f.processing_attempt_id, f.status, f.input_source
    INTO file_attempt_id, file_status, file_input_source
    FROM lts_ai.files_media AS f
    JOIN lts_ai.projects AS p ON p.id = f.project_id
    WHERE f.id = p_file_id
      AND p.user_id = p_user_id
    FOR UPDATE OF f;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'File was not found or is inaccessible.'
            USING ERRCODE = 'P0002';
    END IF;

    IF file_input_source <> 'media'
       OR file_status <> 'processing'
       OR file_attempt_id IS DISTINCT FROM p_attempt_id THEN
        RAISE EXCEPTION 'Processing attempt is not active for this file.'
            USING ERRCODE = 'P0004';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM lts_ai.processing_chunk_claims AS c
        WHERE c.file_id = p_file_id
          AND c.attempt_id = p_attempt_id
          AND (
              c.chunk_index = p_chunk_index
              OR c.chunk_start_seconds = p_chunk_start_seconds
          )
    ) THEN
        RAISE EXCEPTION 'This processing chunk was already submitted.'
            USING ERRCODE = 'P0003';
    END IF;

    SELECT plan, daily_processed_seconds, last_processed_date
    INTO profile_plan, profile_used, profile_date
    FROM lts_ai.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    daily_limit := CASE profile_plan
        WHEN 'pro' THEN 1800
        WHEN 'max' THEN 3600
        ELSE 600
    END;

    effective_used := CASE
        WHEN profile_date = today_utc THEN GREATEST(COALESCE(profile_used, 0), 0)
        ELSE 0
    END;

    IF effective_used + p_duration_seconds > daily_limit THEN
        RAISE EXCEPTION 'Daily processing quota exceeded.'
            USING ERRCODE = 'P0001';
    END IF;

    UPDATE lts_ai.profiles
    SET
        daily_processed_seconds = effective_used + p_duration_seconds,
        last_processed_date = today_utc
    WHERE id = p_user_id;

    UPDATE lts_ai.files_media
    SET processing_last_activity_at = NOW()
    WHERE id = p_file_id;

    INSERT INTO lts_ai.processing_chunk_claims (
        file_id,
        user_id,
        attempt_id,
        chunk_index,
        chunk_start_seconds,
        duration_seconds
    )
    VALUES (
        p_file_id,
        p_user_id,
        p_attempt_id,
        p_chunk_index,
        p_chunk_start_seconds,
        p_duration_seconds
    );

    RETURN jsonb_build_object(
        'claimed', true,
        'duration_seconds', p_duration_seconds,
        'daily_used_seconds', effective_used + p_duration_seconds,
        'daily_limit_seconds', daily_limit
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.claim_processing_chunk(UUID, UUID, UUID, INTEGER, INTEGER, INTEGER) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.claim_processing_chunk(UUID, UUID, UUID, INTEGER, INTEGER, INTEGER) TO service_role;

CREATE OR REPLACE FUNCTION lts_ai.complete_processing_attempt(
    p_user_id UUID,
    p_file_id UUID,
    p_attempt_id UUID,
    p_source_language TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    file_attempt_id UUID;
    file_status TEXT;
    total_duration INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'User identity and processing attempt are required.'
            USING ERRCODE = '42501';
    END IF;

    IF p_source_language IS NULL OR LENGTH(TRIM(p_source_language)) = 0 OR LENGTH(p_source_language) > 32 THEN
        RAISE EXCEPTION 'Invalid source language.'
            USING ERRCODE = '22023';
    END IF;

    SELECT f.processing_attempt_id, f.status
    INTO file_attempt_id, file_status
    FROM lts_ai.files_media AS f
    JOIN lts_ai.projects AS p ON p.id = f.project_id
    WHERE f.id = p_file_id
      AND p.user_id = p_user_id
    FOR UPDATE OF f;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'File was not found or is inaccessible.'
            USING ERRCODE = 'P0002';
    END IF;

    IF file_status <> 'processing' OR file_attempt_id IS DISTINCT FROM p_attempt_id THEN
        RAISE EXCEPTION 'Processing attempt is not active for this file.'
            USING ERRCODE = 'P0004';
    END IF;

    SELECT COALESCE(SUM(c.duration_seconds), 0)::INTEGER
    INTO total_duration
    FROM lts_ai.processing_chunk_claims AS c
    WHERE c.file_id = p_file_id
      AND c.attempt_id = p_attempt_id;

    IF total_duration <= 0 THEN
        RAISE EXCEPTION 'No processing chunks were claimed.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE lts_ai.files_media
    SET
        status = 'completed',
        duration_seconds = total_duration,
        detected_source_lang = TRIM(p_source_language),
        processing_attempt_id = NULL,
        processing_last_activity_at = NULL,
        error_message = NULL
    WHERE id = p_file_id;

    RETURN jsonb_build_object(
        'completed', true,
        'duration_seconds', total_duration
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.complete_processing_attempt(UUID, UUID, UUID, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.complete_processing_attempt(UUID, UUID, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION lts_ai.fail_processing_attempt(
    p_user_id UUID,
    p_file_id UUID,
    p_attempt_id UUID,
    p_error_message TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = lts_ai, public
AS $$
DECLARE
    file_attempt_id UUID;
    file_status TEXT;
BEGIN
    IF p_user_id IS NULL OR p_attempt_id IS NULL THEN
        RAISE EXCEPTION 'User identity and processing attempt are required.'
            USING ERRCODE = '42501';
    END IF;

    SELECT f.processing_attempt_id, f.status
    INTO file_attempt_id, file_status
    FROM lts_ai.files_media AS f
    JOIN lts_ai.projects AS p ON p.id = f.project_id
    WHERE f.id = p_file_id
      AND p.user_id = p_user_id
    FOR UPDATE OF f;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'File was not found or is inaccessible.'
            USING ERRCODE = 'P0002';
    END IF;

    IF file_status = 'completed' THEN
        RETURN;
    END IF;

    IF file_attempt_id IS DISTINCT FROM p_attempt_id THEN
        RAISE EXCEPTION 'Processing attempt is not active for this file.'
            USING ERRCODE = 'P0004';
    END IF;

    UPDATE lts_ai.files_media
    SET
        status = 'failed',
        processing_attempt_id = NULL,
        processing_last_activity_at = NULL,
        error_message = LEFT(COALESCE(NULLIF(TRIM(p_error_message), ''), 'Unknown processing error'), 1000)
    WHERE id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.fail_processing_attempt(UUID, UUID, UUID, TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.fail_processing_attempt(UUID, UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
