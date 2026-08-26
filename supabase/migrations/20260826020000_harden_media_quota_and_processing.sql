-- Harden media processing against client-side file metadata and chunk replay.
-- The Edge Function is the only caller of the service-role-only functions below.
BEGIN;

ALTER TABLE lts_ai.files_media
  ADD COLUMN IF NOT EXISTS processing_attempt_id UUID,
  ADD COLUMN IF NOT EXISTS processing_last_activity_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS lts_ai.processing_chunk_claims (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
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

COMMIT;
