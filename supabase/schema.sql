BEGIN;

DROP SCHEMA IF EXISTS lts_ai CASCADE;
CREATE SCHEMA lts_ai;

REVOKE ALL ON SCHEMA lts_ai FROM PUBLIC;
GRANT USAGE ON SCHEMA lts_ai TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai
    REVOKE ALL ON TABLES FROM PUBLIC, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lts_ai
    GRANT ALL ON TABLES TO service_role;

CREATE TABLE lts_ai.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'user'
        CONSTRAINT profiles_role_allowed
        CHECK (role IN ('user', 'admin')),
    plan TEXT NOT NULL DEFAULT 'free'
        CONSTRAINT profiles_plan_allowed
        CHECK (plan IN ('free', 'pro', 'max')),
    plan_expires_at TIMESTAMPTZ,
    daily_processed_seconds INTEGER NOT NULL DEFAULT 0
        CONSTRAINT profiles_daily_processed_seconds_nonnegative
        CHECK (daily_processed_seconds >= 0),
    last_processed_date DATE NOT NULL
        DEFAULT ((NOW() AT TIME ZONE 'UTC')::DATE),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lts_ai.projects (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    user_id UUID NOT NULL
        REFERENCES lts_ai.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_language TEXT NOT NULL
        CHECK (target_language IN ('vi', 'en', 'zh', 'ja', 'ko', 'fr', 'it')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id
    ON lts_ai.projects(user_id);

CREATE TABLE lts_ai.files_media (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    project_id UUID NOT NULL
        REFERENCES lts_ai.projects(id) ON DELETE CASCADE,
    drive_file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0
        CONSTRAINT files_media_duration_nonnegative
        CHECK (duration_seconds >= 0),
    detected_source_lang TEXT,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'processing', 'completed', 'failed')),
    input_source TEXT NOT NULL DEFAULT 'media'
        CHECK (input_source IN ('media', 'existing_subtitle')),
    error_message TEXT,
    processing_attempt_id UUID,
    processing_last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_files_media_project_id
    ON lts_ai.files_media(project_id);

CREATE TABLE lts_ai.subtitles (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    file_id UUID NOT NULL
        REFERENCES lts_ai.files_media(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, language)
);

CREATE TABLE lts_ai.processing_chunk_claims (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    file_id UUID NOT NULL
        REFERENCES lts_ai.files_media(id) ON DELETE CASCADE,
    user_id UUID NOT NULL
        REFERENCES lts_ai.profiles(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL,
    chunk_index INTEGER NOT NULL
        CHECK (chunk_index >= 0),
    chunk_start_seconds INTEGER NOT NULL
        CHECK (chunk_start_seconds >= 0),
    duration_seconds INTEGER NOT NULL
        CHECK (duration_seconds > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_id, attempt_id, chunk_index),
    UNIQUE (file_id, attempt_id, chunk_start_seconds)
);

CREATE INDEX idx_processing_chunk_claims_user
    ON lts_ai.processing_chunk_claims(user_id);

CREATE TABLE lts_ai.system_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO lts_ai.system_settings (key, value)
VALUES
    ('quotas', jsonb_build_object(
        'free_daily_minutes', 10,
        'free_max_file_size_mb', 50,
        'pro_daily_minutes', 60,
        'pro_max_file_size_mb', 200,
        'max_daily_minutes', 300,
        'max_max_file_size_mb', 500
    ))
ON CONFLICT (key) DO NOTHING;

ALTER TABLE lts_ai.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access for quotas"
    ON lts_ai.system_settings
    FOR SELECT
    USING (key = 'quotas');

GRANT SELECT ON lts_ai.system_settings TO anon, authenticated;
GRANT ALL ON lts_ai.system_settings TO service_role;

CREATE OR REPLACE FUNCTION lts_ai.get_system_quotas()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = lts_ai, public
AS $$
    SELECT value FROM lts_ai.system_settings WHERE key = 'quotas';
$$;

REVOKE ALL ON FUNCTION lts_ai.get_system_quotas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lts_ai.get_system_quotas() TO anon, authenticated, service_role;

CREATE TABLE lts_ai.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    actor_user_id UUID
        REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID
        REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_log_actor
    ON lts_ai.admin_audit_log(actor_user_id);

CREATE INDEX idx_admin_audit_log_target
    ON lts_ai.admin_audit_log(target_user_id);

CREATE INDEX idx_admin_audit_log_created_at
    ON lts_ai.admin_audit_log(created_at DESC);

ALTER TABLE lts_ai.profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.projects                ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.files_media             ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.subtitles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.processing_chunk_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.admin_audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE lts_ai.system_settings         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
    ON lts_ai.profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can create own basic profile"
    ON lts_ai.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own basic profile"
    ON lts_ai.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can manage own projects"
    ON lts_ai.projects
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own media files"
    ON lts_ai.files_media
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM lts_ai.projects
            WHERE projects.id = files_media.project_id
              AND projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM lts_ai.projects
            WHERE projects.id = files_media.project_id
            AND projects.user_id = auth.uid()
        )
        AND duration_seconds = 0
        AND status = 'draft'
        AND processing_attempt_id IS NULL
        AND processing_last_activity_at IS NULL
        AND error_message IS NULL
    );

CREATE POLICY "Users can manage own subtitles"
    ON lts_ai.subtitles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1
            FROM lts_ai.files_media
            JOIN lts_ai.projects
              ON projects.id = files_media.project_id
            WHERE files_media.id = subtitles.file_id
              AND projects.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM lts_ai.files_media
            JOIN lts_ai.projects
              ON projects.id = files_media.project_id
            WHERE files_media.id = subtitles.file_id
              AND projects.user_id = auth.uid()
        )
    );

REVOKE ALL ON ALL TABLES IN SCHEMA lts_ai FROM PUBLIC, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA lts_ai TO service_role;

GRANT SELECT ON lts_ai.profiles TO authenticated;
GRANT INSERT (id, email, full_name) ON lts_ai.profiles TO authenticated;
GRANT UPDATE (id, email, full_name) ON lts_ai.profiles TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON lts_ai.projects TO authenticated;

GRANT SELECT, INSERT, DELETE
ON lts_ai.files_media
TO authenticated;

GRANT UPDATE (file_name)
ON lts_ai.files_media
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON lts_ai.subtitles TO authenticated;

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
    attempt_id UUID := pg_catalog.gen_random_uuid();
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

    IF file_status NOT IN ('draft', 'failed') THEN
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

    RETURN jsonb_build_object('started', true, 'attempt_id', attempt_id);
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
    profile_expires_at TIMESTAMPTZ;
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

    IF p_chunk_index IS NULL
       OR p_chunk_index < 0
       OR p_chunk_start_seconds IS NULL
       OR p_chunk_start_seconds < 0
       OR p_chunk_start_seconds <> p_chunk_index::BIGINT * 420
       OR p_duration_seconds IS NULL
       OR p_duration_seconds <= 0
       OR p_duration_seconds > 420
    THEN
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
       OR file_attempt_id IS DISTINCT FROM p_attempt_id
    THEN
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

    SELECT plan, plan_expires_at, daily_processed_seconds, last_processed_date
    INTO profile_plan, profile_expires_at, profile_used, profile_date
    FROM lts_ai.profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Profile was not found.'
            USING ERRCODE = 'P0002';
    END IF;

    IF profile_plan <> 'free' AND profile_expires_at IS NOT NULL AND profile_expires_at < NOW() THEN
        profile_plan := 'free';
        UPDATE lts_ai.profiles
        SET plan = 'free', plan_expires_at = NULL
        WHERE id = p_user_id;
    END IF;

    SELECT COALESCE(
        CASE profile_plan
            WHEN 'pro' THEN (s.value->>'pro_daily_minutes')::INTEGER * 60
            WHEN 'max' THEN (s.value->>'max_daily_minutes')::INTEGER * 60
            ELSE (s.value->>'free_daily_minutes')::INTEGER * 60
        END,
        CASE profile_plan
            WHEN 'pro' THEN 3600
            WHEN 'max' THEN 18000
            ELSE 600
        END
    )
    INTO daily_limit
    FROM lts_ai.system_settings AS s
    WHERE s.key = 'quotas';

    IF daily_limit IS NULL THEN
        daily_limit := CASE profile_plan
            WHEN 'pro' THEN 3600
            WHEN 'max' THEN 18000
            ELSE 600
        END;
    END IF;

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
        file_id, user_id, attempt_id, chunk_index, chunk_start_seconds, duration_seconds
    )
    VALUES (
        p_file_id, p_user_id, p_attempt_id, p_chunk_index, p_chunk_start_seconds, p_duration_seconds
    );

    RETURN jsonb_build_object(
        'claimed', true,
        'duration_seconds', p_duration_seconds,
        'daily_used_seconds', effective_used + p_duration_seconds,
        'daily_limit_seconds', daily_limit
    );
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.claim_processing_chunk(
    UUID, UUID, UUID, INTEGER, INTEGER, INTEGER
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.claim_processing_chunk(
    UUID, UUID, UUID, INTEGER, INTEGER, INTEGER
) TO service_role;

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

    IF p_source_language IS NULL
       OR LENGTH(TRIM(p_source_language)) = 0
       OR LENGTH(p_source_language) > 32
    THEN
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

    IF file_status <> 'processing'
       OR file_attempt_id IS DISTINCT FROM p_attempt_id
    THEN
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

    RETURN jsonb_build_object('completed', true, 'duration_seconds', total_duration);
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.complete_processing_attempt(
    UUID, UUID, UUID, TEXT
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.complete_processing_attempt(
    UUID, UUID, UUID, TEXT
) TO service_role;

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
        error_message = LEFT(
            COALESCE(NULLIF(TRIM(p_error_message), ''), 'Unknown processing error'),
            1000
        )
    WHERE id = p_file_id;
END;
$$;

REVOKE ALL ON FUNCTION lts_ai.fail_processing_attempt(
    UUID, UUID, UUID, TEXT
) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION lts_ai.fail_processing_attempt(
    UUID, UUID, UUID, TEXT
) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;