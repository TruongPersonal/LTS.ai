-- Admin role, protected profile fields, quota reservation and minimal plan audit.
-- After applying this migration, bootstrap the first admin manually with the
-- real auth user id, for example:
-- UPDATE lts_ai.profiles SET role = 'admin' WHERE email = 'your-admin@email.com';
BEGIN;

ALTER TABLE lts_ai.profiles
  ADD COLUMN IF NOT EXISTS role TEXT;

UPDATE lts_ai.profiles
SET role = 'user'
WHERE role IS NULL;

ALTER TABLE lts_ai.profiles
  ALTER COLUMN role SET DEFAULT 'user',
  ALTER COLUMN role SET NOT NULL;

ALTER TABLE lts_ai.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_allowed;

ALTER TABLE lts_ai.profiles
  ADD CONSTRAINT profiles_role_allowed
  CHECK (role IN ('user', 'admin'));

CREATE TABLE IF NOT EXISTS lts_ai.admin_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor
    ON lts_ai.admin_audit_log(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
    ON lts_ai.admin_audit_log(target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
    ON lts_ai.admin_audit_log(created_at DESC);

ALTER TABLE lts_ai.admin_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON lts_ai.admin_audit_log FROM authenticated;
GRANT ALL ON lts_ai.admin_audit_log TO service_role;

DROP POLICY IF EXISTS "Users can manage own profile"
ON lts_ai.profiles;

DROP POLICY IF EXISTS "Users can read own profile"
ON lts_ai.profiles;

DROP POLICY IF EXISTS "Users can create own basic profile"
ON lts_ai.profiles;

DROP POLICY IF EXISTS "Users can update own basic profile"
ON lts_ai.profiles;

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

REVOKE INSERT, UPDATE, DELETE
ON lts_ai.profiles
FROM authenticated;

GRANT SELECT
ON lts_ai.profiles
TO authenticated;

GRANT INSERT (id, email, full_name)
ON lts_ai.profiles
TO authenticated;

-- Upsert may include the conflict key in its generated UPDATE clause. The
-- policy still requires the new id to equal auth.uid(), so this does not allow
-- moving a profile to another user.
GRANT UPDATE (id, email, full_name)
ON lts_ai.profiles
TO authenticated;

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

COMMIT;
