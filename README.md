# LTS.ai — Submission Edition

A lightweight subtitle studio for a course submission. The app keeps only the user-facing flow: Google sign-in, projects, Google Drive media/imported subtitles, AI transcription + translation, bilingual subtitle editing, simple retry, visible processing progress, and export.

## Architecture

- React + TypeScript + Vite
- Google-only Supabase Auth
- Supabase Postgres (`lts_ai` schema)
- Browser-side `ffmpeg.wasm` preprocessing
- One Supabase Edge Function: `process-media`
- Groq Whisper for transcription
- Groq Llama for subtitle translation

The browser never contains the Groq API key. For media files, it downloads the Google Drive file with the user's Google OAuth provider token, uses one FFmpeg pass to extract and segment audio as FLAC 16 kHz mono/s16, then sends each FLAC chunk to the Edge Function. The Google provider token is never forwarded to the Edge Function. The Edge Function uses the signed-in Supabase JWT for database authorization and keeps `GROQ_API_KEY` server-side.

## Setup

1. Copy `.env.example` to `.env` and configure the Supabase URL and anon key.
2. Apply `supabase/schema.sql` for a fresh database, or apply the submission migration when upgrading an older submission database.
3. In Supabase Auth, configure Google OAuth with the required Drive scopes. The application exposes Google sign-in only.
4. Configure the Edge Function secret `GROQ_API_KEY` in Supabase.
5. Deploy `process-media`.
6. Install dependencies and run:

```bash
npm install
npm test
npm run lint
npm run build
```

## Google OAuth token handling

The Supabase client registers an auth-state listener as soon as it is created and persists `session.provider_token` for Google Drive requests. React consumers use the centralized `getGoogleAccessToken()` helper instead of reading session/localStorage independently. Signing out removes the stored provider token.

If Google revokes or expires the provider token, Drive operations stop with an explicit re-authentication message instead of silently falling back to an unauthenticated stream.

## Media processing flow

```text
Google Drive media
  -> authenticated browser download
  -> ffmpeg.wasm single-pass segmentation
  -> FLAC / mono / 16 kHz / signed 16-bit
  -> fixed chunks (maximum 420 seconds)
  -> hard limit: 19.5 MB (19,500,000 bytes) per FLAC chunk
  -> process-media: transcribe_chunk (sequential)
  -> browser merges global cue timestamps
  -> process-media: finalize_media
  -> source subtitle + translated subtitle
  -> completed
```

There is no duration-probe step in this flow. FFmpeg's segment muxer creates the FLAC chunks directly, avoiding a second decode/encode pass and the previous duration-read failure path.

Imported SRT/VTT files skip Whisper and use the `process_existing_subtitle` Edge action. Failed files keep an error message and can be retried from the project screen.

## Processing progress

Progress is intentionally transient frontend state rather than production job infrastructure. Each file reports stages such as:

```text
Waiting
-> Preparing
-> Downloading from Drive
-> FFmpeg audio preprocessing
-> Whisper chunk 1/N ... N/N
-> Merging cues
-> Translating and saving
-> 100% Completed
```

The project screen shows a progress bar and stage text per file. No queue, polling table, durable progress record, or background worker is added.

## Editor video flow

The editor fetches Drive media with the Google OAuth token and creates a browser Blob URL. `VideoPlayer` uses only native HTML5 `<video>`, so `timeupdate`, active-cue highlighting, auto-scroll, and click-to-seek remain synchronized. There is no Google Drive iframe or unauthenticated direct-stream fallback; token/download/codec errors are shown explicitly.

## Deliberately omitted production core

This submission edition does not include a queue, worker, execution lease, durable retry scheduler, dead-letter queue, provider concurrency pool, moderation pipeline, translation continuity memory, or crash recovery engine.

## Interface preferences

The submission UI supports Vietnamese, English, and Japanese interface languages. The selected language is stored locally under `lts_language`. Appearance supports Light, Dark, and System modes under `lts_theme`. Signed-in users can change language and appearance directly from compact controls in the user menu; Landing and Login expose the same compact controls in the header. These preferences are presentation-only and do not add database settings tables.

## Workspace navigation and visual design

Signed-in screens use a compact left navigation rail rather than a global top navbar. The rail defaults to a compact icon view, can be expanded on desktop, and stores the preference under `lts_sidebar_collapsed`. The editor temporarily uses the compact rail so the video and subtitle viewport receive the maximum practical width; returning to other screens restores the user's prior sidebar preference. On small screens the rail becomes an overlay drawer.

The submission visual system is neutral-first: light mode uses a white canvas with a soft neutral sidebar, while dark mode uses charcoal surfaces. Primary actions use high-contrast neutral foreground/background colors; the LTS accent is reserved for selection, focus, active cues, and processing emphasis. Project screens are presented as content workspaces rather than administration tables, and the landing page is product-first with a large editor preview and open workflow narrative.
