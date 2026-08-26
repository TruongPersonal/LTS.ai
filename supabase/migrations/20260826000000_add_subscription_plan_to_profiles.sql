-- Keep existing profiles compatible with the subscription plan flow.
BEGIN;

ALTER TABLE lts_ai.profiles
  ADD COLUMN IF NOT EXISTS plan TEXT;

UPDATE lts_ai.profiles
SET plan = 'free'
WHERE plan IS NULL;

ALTER TABLE lts_ai.profiles
  ALTER COLUMN plan SET DEFAULT 'free',
  ALTER COLUMN plan SET NOT NULL;

ALTER TABLE lts_ai.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_allowed;

ALTER TABLE lts_ai.profiles
  ADD CONSTRAINT profiles_plan_allowed
  CHECK (plan IN ('free', 'pro', 'max'));

-- Make the new column visible to PostgREST immediately after the migration.
NOTIFY pgrst, 'reload schema';

COMMIT;
