-- Enforce the media processing boundary after the new client and Edge Function are deployed.
BEGIN;

-- A user may submit only the metadata needed to create a file and rename it later.
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

NOTIFY pgrst, 'reload schema';

COMMIT;
