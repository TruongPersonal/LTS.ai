-- Reduce the submission database to the four user-facing tables and simple processing states.
ALTER TABLE IF EXISTS lts_ai.profiles
  DROP COLUMN IF EXISTS role,
  DROP COLUMN IF EXISTS is_banned,
  DROP COLUMN IF EXISTS flagged_count;

ALTER TABLE IF EXISTS lts_ai.files_media
  DROP COLUMN IF EXISTS is_flagged,
  DROP COLUMN IF EXISTS flagged_reason;

UPDATE lts_ai.files_media
SET status = 'failed', error_message = COALESCE(error_message, 'Vui lòng xử lý lại tệp.')
WHERE status IN ('pending', 'flagged_review');

ALTER TABLE IF EXISTS lts_ai.files_media DROP CONSTRAINT IF EXISTS files_media_status_check;
ALTER TABLE IF EXISTS lts_ai.files_media
  ADD CONSTRAINT files_media_status_check CHECK (status IN ('draft', 'processing', 'completed', 'failed'));

DROP POLICY IF EXISTS "Users can view profiles" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can insert profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON lts_ai.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON lts_ai.profiles;
CREATE POLICY "Users can view own profile" ON lts_ai.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON lts_ai.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON lts_ai.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO lts_ai.profiles (id, email, full_name)
    VALUES (
        new.id,
        COALESCE(new.email, ''),
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
