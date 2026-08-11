import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const assertBackend = (condition, message) => {
  if (hasSupabaseBackend) assert(condition, message);
};

const aiServicePath = 'src/services/aiProcessingService.ts';
const fileService = read('src/services/fileService.ts');
const subtitleService = read('src/services/subtitleService.ts');
const edgePath = 'supabase/functions/process-media/index.ts';
const schemaPath = 'supabase/schema.sql';
const hasSupabaseBackend = fs.existsSync(edgePath) && fs.existsSync(schemaPath);
const edge = hasSupabaseBackend ? read(edgePath) : '';
const app = read('src/App.tsx');
const navbar = read('src/components/common/Navbar.tsx');
const schema = hasSupabaseBackend ? read(schemaPath) : '';
const types = read('src/types/database.ts');
const profilePage = fs.existsSync('src/pages/ProfilePage.tsx') ? read('src/pages/ProfilePage.tsx') : '';
const loginPage = read('src/pages/LoginPage.tsx');
const userDropdown = read('src/components/common/UserDropdown.tsx');
const authContext = read('src/context/AuthContext.tsx');
const supabaseClient = read('src/lib/supabase.ts');
const editorPage = read('src/pages/EditorPage.tsx');
const projectDetail = read('src/pages/ProjectDetailPage.tsx');
const fileListTabs = read('src/components/media/FileListTabs.tsx');
const videoPlayer = read('src/components/editor/VideoPlayer.tsx');
const pkg = JSON.parse(read('package.json'));

assert(!fs.existsSync(aiServicePath), 'Browser-side Groq AI service must be removed');
assert(!fileService.includes('VITE_GROQ_API_KEY'), 'Browser code must not reference VITE_GROQ_API_KEY');
assert(fileService.includes('downloadDriveMedia'), 'Browser must download Drive media before preprocessing');
assert(fileService.includes(".in('status', ['draft', 'failed'])"), 'Retry must include failed files');
assert(!fileService.includes("status: 'completed'"), 'Browser must not mark AI files completed');

assertBackend(edge.includes("jsonBody.project_id") || edge.includes("multipartBody.get('project_id')"), 'Edge must consume project_id for JSON or multipart actions');
assertBackend(edge.includes("schema: 'lts_ai'"), 'Edge Supabase client must use lts_ai schema');
assertBackend(edge.includes(".from('files_media')"), 'Edge must use files_media table');
assertBackend(!edge.includes(".from('files')"), 'Edge must not use obsolete files table');
assertBackend(!edge.includes("temp-audio"), 'Submission flow must not depend on temp-audio storage');
assertBackend(!edge.includes('is_flagged'), 'Submission Edge flow must not contain moderation state');
assertBackend(!edge.includes('flagged_review'), 'Submission Edge flow must not contain flagged review state');
assertBackend(edge.includes("onConflict: 'file_id,language'"), 'Edge subtitle writes must upsert on file_id,language');

assert(subtitleService.includes("onConflict: 'file_id,language'"), 'Subtitle service must upsert on file_id,language');
assert(!subtitleService.includes(".eq('file_id', fileId)\n      .maybeSingle()"), 'Subtitle save must not select by file_id alone');

assert(!app.includes('AdminDashboardPage'), 'Admin dashboard must be removed from submission app');
assert(!navbar.includes('Khu Vực Admin'), 'Navbar must not expose admin area');
assert(!types.includes("'flagged_review'"), 'File status type must not contain flagged_review');
assertBackend(!schema.includes('flagged_reason'), 'Submission schema must not contain moderation fields');
assertBackend(!schema.includes('flagged_count'), 'Submission schema must not contain moderation counters');
assert(!loginPage.includes('signInWithPassword'), 'Submission login must be Google-only');
assert(!loginPage.includes('type="password"'), 'Submission login must not render a password field');
assert(!profilePage.includes('updateUser({ password:'), 'Submission UI must not expose password updates');
assert(!userDropdown.includes('ChangePasswordModal'), 'User menu must not expose password changes');
assert(!fs.existsSync('src/components/common/ChangePasswordModal.tsx'), 'Password modal must be removed');
assert(supabaseClient.includes('persistGoogleProviderToken'), 'Supabase client must centrally persist Google provider tokens');
assert(supabaseClient.includes('getGoogleAccessToken'), 'Supabase client must expose a Google access-token getter');
assert(authContext.includes('getGoogleAccessToken'), 'Auth context must validate Google provider-token availability');
assertBackend(!schema.includes('FOR SELECT USING (true)'), 'Profile RLS must not expose every profile');
assert(!pkg.dependencies?.['react-player'], 'Unused react-player dependency must be removed');


assert(subtitleService.includes('getSubtitlePair'), 'Editor must load source and target subtitle rows together');
assert(subtitleService.includes("?? records.find((record) => record.language !== targetLanguage)"), 'Subtitle pair loading must fall back to a non-target source row');
assert(editorPage.includes('sourceSubtitles'), 'Editor must keep source subtitles for comparison');
assert(editorPage.includes('findActiveCueId'), 'Editor must derive the active cue from video time');
assert(editorPage.includes('scrollTo') && editorPage.includes('cueViewportRef'), 'Editor must auto-scroll the active cue inside the cue viewport');
assert(editorPage.includes("window.addEventListener('beforeunload'"), 'Editor must warn before browser unload with unsaved changes');
assert(editorPage.includes('ConfirmDialog') && editorPage.includes('showUnsavedExitDialog'), 'Editor Back action must protect unsaved changes with the app confirm dialog');
assert(!app.includes('window.confirm'), 'App navigation must not use browser confirm dialogs');
assert(editorPage.includes('handleAddCue'), 'Editor must support adding a cue');
assert(editorPage.includes('cuePendingDelete') && editorPage.includes('confirmDeleteCue'), 'Editor must support confirmed cue deletion');
assert(editorPage.includes("type=\"number\"") && editorPage.includes('handleStartTimingEdit') && editorPage.includes('handleConfirmTimingEdit') && editorPage.includes('Pencil'), 'Editor must support pencil-triggered cue start/end timing edits');
assert(editorPage.includes('sourceText') && editorPage.includes('sourceVisible'), 'Editor must keep source subtitle content with independent visibility');
assert(!editorPage.includes("{t('editor.original')} ·"), 'Editor cue cards must not render the legacy source label');
assert(videoPlayer.includes('src={videoUrl}'), 'Video player must use the authenticated Blob URL directly');
assert(videoPlayer.includes('Math.abs(videoRef.current.currentTime - currentTime)'), 'Video player must not seek on every playback time update');
assert(editorPage.includes('getGoogleAccessToken'), 'Editor media fetch must use the centralized Google token getter');



assert(fileService.includes('retryProcessingFile'), 'File service must expose single-file retry');
assert(fileService.includes('file_id: fileId'), 'Single-file retry must send file_id to process-media');
assertBackend(edge.includes(".eq('id', fileId)"), 'Edge actions must scope processing to a single file_id');
assert(fileListTabs.includes("t('media.retry')"), 'Failed file UI must expose a localized retry action');
assert(fileListTabs.includes('onRetryFile'), 'File list must delegate retry to its parent');
assert(projectDetail.includes('handleRetryFile'), 'Project detail must refresh after a single-file retry');


const audioPreprocessorPath = 'src/services/mediaAudioPreprocessor.ts';
const mediaProcessingPath = 'src/utils/mediaProcessing.ts';
assert(fs.existsSync(audioPreprocessorPath), 'Browser FLAC audio preprocessor must exist');
assert(fs.existsSync(mediaProcessingPath), 'Media transcription merge helper must exist');
const audioPreprocessor = fs.existsSync(audioPreprocessorPath) ? read(audioPreprocessorPath) : '';
assert(pkg.dependencies?.['@ffmpeg/ffmpeg'], 'ffmpeg.wasm dependency must be present');
assert(pkg.dependencies?.['@ffmpeg/util'], 'ffmpeg.wasm util dependency must be present');
assert(audioPreprocessor.includes("'-ac'") && audioPreprocessor.includes("'16000'") && audioPreprocessor.includes("'-c:a'") && audioPreprocessor.includes("'flac'"), 'Browser preprocessor must normalize to mono 16 kHz FLAC');
assert(fileService.includes('extractFlacChunks'), 'File service must preprocess Drive media into FLAC chunks');
assert(fileService.includes("formData.append('action', 'transcribe_chunk')"), 'File service must send FLAC chunks through multipart transcribe_chunk requests');
assert(fileService.includes("formData.append('audio'"), 'File service must attach FLAC audio to Edge multipart requests');
assert(!fileService.includes('google_access_token: accessToken'), 'Google provider token must not be sent to Edge');
assertBackend(edge.includes("action === 'transcribe_chunk'"), 'Edge must support transcribe_chunk action');
assertBackend(edge.includes("multipartBody.get('audio')"), 'Edge must read multipart FLAC audio');
assertBackend(edge.includes("action === 'finalize_media'"), 'Edge must support finalize_media action');
assertBackend(!edge.includes('www.googleapis.com/drive/v3/files'), 'Edge must no longer download Google Drive media');
assertBackend(!edge.includes('google_access_token'), 'Edge must not receive Google provider tokens');
assert(!videoPlayer.includes('<iframe'), 'Editor video player must not use iframe fallback');
assert(!videoPlayer.includes('lh3.googleusercontent.com'), 'Editor video player must not use unauthenticated direct Drive streams');
assert(videoPlayer.includes('<video'), 'Editor must use native HTML5 video');

if (!hasSupabaseBackend) console.log('submission backend regression: SKIP (Supabase backend files are not included in this archive)');
console.log('submission regression contracts: PASS');

assert(!audioPreprocessor.includes('ffprobe'), 'Browser preprocessing must not depend on ffprobe');
assert(!audioPreprocessor.includes('normalizedName'), 'Browser preprocessing must not create an intermediate normalized FLAC');
assert(audioPreprocessor.includes("'-f',") && audioPreprocessor.includes("'segment'") && audioPreprocessor.includes("'-segment_time'") && audioPreprocessor.includes("'420'"), 'FFmpeg must segment FLAC in one pass at 420-second boundaries');
assert(audioPreprocessor.includes('19_500_000'), 'Browser FLAC hard limit must be 19.5 MB (decimal)');
assertBackend(edge.includes('19_500_000'), 'Edge FLAC hard limit must be 19.5 MB (decimal)');
assertBackend(!edge.includes('24 MB'), 'Edge must not advertise the obsolete 24 MB limit');
assert(fileService.includes('ProcessingProgress'), 'File service must expose processing progress events');
assert(fileService.includes('onProgress'), 'File processing must emit progress callbacks');
assert(projectDetail.includes('processingProgressByFile'), 'Project detail must retain per-file processing progress');
assert(fileListTabs.includes('processingProgressByFile'), 'File list must render per-file processing progress');
