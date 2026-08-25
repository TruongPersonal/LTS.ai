# Client-side MP4 Export With Burned-in Target Subtitles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Add a focused Editor-only MP4 export flow that burns the current target/translation subtitles into the fetched video Blob, downloads the result as an MP4, and preserves the existing subtitle-file export, playback, and project-detail flows.

**Architecture:** Share the existing FFmpeg loader through one runtime module and serialize all FFmpeg filesystem/exec activity with one mutex. Keep export orchestration in a dedicated service, keep the feature UI in a dedicated VideoExportModal, and keep draft reconciliation local to EditorPage. Capability validation is a one-time manual/development gate before exposing the UI; it is not a render-time probe and does not become a persistent service.

**Tech Stack:** React, TypeScript, Vite, @ffmpeg/ffmpeg 0.12.x, @ffmpeg/util, existing file-saver, existing ModalWrapper and i18n setup. No new dependency, test framework, backend endpoint, worker, generic modal abstraction, encoder fallback, or global processing state.

**Spec:** docs/superpowers/specs/2026-08-25-video-subtitle-export-design.md

## Global Constraints

- MP4 V1.1 burns only target/translation subtitles. Source and bilingual tracks remain available only through the existing subtitle-file export.
- Video files with a picture stream and no audio stream are supported and produce a video-only MP4.
- Audio-only inputs are unsupported. Reject them at the UI/service boundary; do not convert MP3 or other audio-only input into MP4.
- Reuse the Blob already fetched by useEditorVideo. Do not fetch the Google Drive file a second time.
- Export uses the current effective Editor state: committed target subtitles plus the active target text draft and valid active timing draft. Source drafts are ignored.
- A non-empty draft text is still a draft value; an intentionally empty target text must be passed through. An empty subtitle list is not exportable.
- A timing draft is valid only when both fields are non-empty, finite numbers, start is at least 0, and end is greater than start. An invalid timing draft disables export.
- One shared FFmpeg instance/loader is used by audio preprocessing and video export.
- The mutex covers the complete FFmpeg FS/exec lifecycle: acquire before loading or using FFmpeg, hold through all writes, exec calls, reads, yields, and cleanup, and release only from finally.
- The capability probe runs once as a manual/development validation before the UI is exposed. It must not run on every render, Editor mount, or export, and no persistent capability service/cache is added.
- libx264 is a required capability and the only V1.1 video encoder. Do not add a system-encoder fallback.
- Bundle exactly one approved `NotoSansCJKjp-Regular.otf` version `2.004` asset (~16.47 MB) with its SIL OFL 1.1 license notice; use the existing `public/` static-asset convention and no asset-management layer.
- Write the bundled font to `/fonts/NotoSansCJKjp-Regular.otf` inside the locked FFmpeg lifecycle and use `fontsdir=/fonts:force_style=FontName=Noto Sans CJK JP`.
- Do not add font discovery, fontconfig, fallback, resolver, manager, user font selection/upload, CDN loading, subsetting, compression, lazy registry, or font cache. The known `can't find selected font provider` warning is non-fatal when libass resolves the configured font and representative glyphs render.
- Use optional audio mapping so the same command supports audio-bearing and video-only inputs. Do not add scale/fps settings or export settings UI.
- Use existing ModalWrapper for a feature-specific VideoExportModal. Do not create a generic modal abstraction.
- Keep the feature local to EditorPage. Do not route it through ProcessingContext, useGlobalProcessing, FloatingProcessingWidget, ProjectDetailPage, or subtitle exporter utilities.
- Preserve all unrelated working-tree changes and stage only files belonging to this implementation when committing.

## Task 1: Establish a clean validation baseline

- [ ] Inspect the current working tree and branch without changing existing user work.

  Commands:

  ~~~text
  git status --short
  git branch --show-current
  ~~~

- [ ] Run the existing checks before touching implementation files:

  ~~~text
  npm run lint
  npm run build
  git diff --check
  ~~~

- [ ] Confirm the current FFmpeg ownership and export boundaries:

  ~~~text
  rg -n "FFmpeg|ffmpeg|ExportModal|ProcessingContext|useEditorVideo|useEditorDraft" src package.json
  rg --files src | rg "test|spec|vitest|jest|playwright"
  ~~~

- [ ] Record any baseline failure as pre-existing and do not introduce a test dependency or alter unrelated files to make the baseline pass.

## Task 2: Extract the shared FFmpeg runtime and add the execution mutex

**Files:**

- Add src/services/ffmpegRuntime.ts.
- Modify src/services/mediaAudioPreprocessor.ts.

- [ ] Move the existing FFmpeg core version, CDN base URL, singleton promise, and loader into ffmpegRuntime.ts without changing the existing core version or ESM URL.

- [ ] Export only the runtime primitives needed by the two services:

  ~~~typescript
  export async function getFfmpeg(): Promise<FFmpeg>;
  export async function acquireFfmpegLock(): Promise<() => void>;
  ~~~

- [ ] Preserve singleton load behavior: concurrent callers share one load promise, and a failed load resets the promise so a later operation can retry.

- [ ] Implement FIFO serialization with a promise tail. The returned release function resolves exactly one queued operation:

  ~~~typescript
  let ffmpegLockTail = Promise.resolve();

  export async function acquireFfmpegLock(): Promise<() => void> {
    const previous = ffmpegLockTail;
    let release!: () => void;
    ffmpegLockTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    return release;
  }
  ~~~

- [ ] Update extractFlacChunks so it acquires the mutex before getFfmpeg and holds the lock over every writeFile, exec, readFile, deleteFile, yielded chunk, and cleanup operation.

- [ ] Keep the audio lock release in the generator’s outer finally. Use a nullable local FFmpeg reference so failed loading does not cause cleanup to throw. The generator must not release between yielded chunks.

- [ ] Preserve the audio preprocessor’s command behavior, output shape, normalization, and temporary-file cleanup. Only loader ownership and serialization should change.

- [ ] Run the build after this task:

  ~~~text
  npm run build
  ~~~

- [ ] Commit only the runtime/preprocessor changes:

  ~~~text
  git add -- src/services/ffmpegRuntime.ts src/services/mediaAudioPreprocessor.ts
  git commit -m "refactor: share serialized ffmpeg runtime"
  ~~~

## Task 3: Expose the already-fetched video Blob

**File:** Modify src/hooks/useEditorVideo.ts.

- [ ] Add a videoBlob state value and return it from the hook.

- [ ] Set videoBlob to the same resolved Blob that currently creates the playback Object URL. Do not add a second fetch, clone request, or separate Google Drive loading path.

- [ ] Clear videoBlob when a new media load starts, when loading fails, and when the resolved media is unsupported. Keep the existing Object URL revoke behavior and reload behavior.

- [ ] Preserve current videoUrl, currentTime, setCurrentTime, loading, error, and reloadVideo semantics.

- [ ] Run:

  ~~~text
  npm run build
  ~~~

- [ ] Commit only the hook change:

  ~~~text
  git add -- src/hooks/useEditorVideo.ts
  git commit -m "feat: expose editor video blob for export"
  ~~~

## Task 4: Implement the video subtitle export service and perform the one-time capability gate

**Files:** Add src/services/videoSubtitleExporter.ts, public/NotoSansCJKjp-Regular.otf, and public/NotoSansCJKjp-Regular.LICENSE.txt.

- [ ] Add the single approved font asset and its SIL OFL 1.1 license/copyright notice. Do not add any other font asset or font abstraction.

- [ ] Define a focused service API:

  ~~~typescript
  export type VideoExportErrorKind =
    | "load"
    | "unsupported"
    | "execution"
    | "output";

  export interface VideoSubtitleExportOptions {
    videoBlob: Blob;
    subtitles: SubtitleItem[];
    fileName: string;
    onProgress?: (progress: number) => void;
  }

  export async function exportVideoWithSubtitles(
    options: VideoSubtitleExportOptions,
  ): Promise<Blob>;
  ~~~

- [ ] Reject before FFmpeg work when the Blob is empty, not video/*, or explicitly audio/*. Reject an empty subtitle list. Use typed errors carrying one of the four error kinds so EditorPage can show stable localized messages.

- [ ] Create a unique invocation token and use tokenized names for input.mp4, subtitles.srt, and output.mp4. This prevents one invocation from colliding with another while the mutex serializes FFmpeg access.

- [ ] Acquire the shared FFmpeg mutex before getFfmpeg and keep it until after output read and all temporary-file deletion. Put release at the end of the outer finally.

- [ ] Write the input with @ffmpeg/util fetchFile and write the SRT with TextEncoder over the existing exportToSrt serializer. The service must serialize target subtitles only and must not use source or bilingual export modes.

- [ ] Write the bundled font into `/fonts/NotoSansCJKjp-Regular.otf` while holding the same mutex. Delete that font path in the same outer `finally`; do not keep it as a cache.

- [ ] Register one progress listener for the current invocation, report a normalized 0–1 value through onProgress, and remove the listener in finally even when exec fails.

- [ ] Execute exactly this V1.1 command shape, with the tokenized names:

  ~~~text
  -y
  -i input.mp4
  -map 0:v:0
  -map 0:a?
-vf subtitles=subtitles.srt:fontsdir=/fonts:force_style=FontName=Noto Sans CJK JP
  -c:v libx264
  -preset veryfast
  -crf 23
  -pix_fmt yuv420p
  -c:a aac
  -b:a 128k
  -movflags +faststart
  output.mp4
  ~~~

- [ ] Do not add a scale filter, frame-rate filter, encoder fallback, font-selection subsystem, settings UI, MP3 conversion path, or backend fallback. The fixed `FontName` is the only approved font selection behavior.

- [ ] Read the output file while still holding the mutex, return a Blob with type video/mp4, and throw output when the file is missing or empty.

- [ ] Delete every invocation-owned temporary file in finally. Cleanup failures must not prevent the mutex release; preserve the primary error when cleanup also fails.

- [ ] Run the build before exposing any UI:

  ~~~text
  npm run build
  ~~~

- [ ] Perform one manual/development capability probe before Task 5:

  1. Start the existing Vite dev server on localhost.
  2. In the browser console or a temporary dev-only evaluation, dynamically import the runtime and export service modules; do not commit probe code.
  3. Fetch a small local video fixture or the shortest available completed Editor video, write the approved font to `/fonts`, construct the seven approved representative target strings (`vi`, `en`, `zh`, `ja`, `ko`, `fr`, `it`), and run two exports sequentially.
  4. Verify both results are non-empty video/mp4 Blobs, progress callbacks are observed, and the second export succeeds after the first.
  5. Inspect the FFmpeg root directory after each run and verify no invocation-owned export files remain.
  6. Verify an audio-bearing video retains usable audio and a video-only input exports successfully without audio.
  7. Verify an audio-only Blob is rejected before an export command is run.
  8. Verify the generated MP4 visibly contains all seven representative target strings during playback/fullscreen or frame/pixel inspection; do not rely on exit code alone.

- [ ] If the available local fixture has no audio, use the shortest completed signed-in Editor video for the audio-bearing check. Do not add a production fixture solely for probing.

- [ ] Treat failure of required libx264, configured font resolution, any representative glyph rendering, video-only output, cleanup, or sequential locking as a capability gate failure. Stop before adding UI and fix only within the approved service/runtime scope; do not introduce a fallback encoder or persistent capability service.

- [ ] Commit the service after the one-time probe passes:

  ~~~text
  git add -- src/services/videoSubtitleExporter.ts src/services/ffmpegRuntime.ts src/services/mediaAudioPreprocessor.ts
  git commit -m "feat: add client-side video subtitle exporter"
  ~~~

## Task 5: Wire effective Editor drafts and the feature-specific export UI

**Files:**

- Add src/components/editor/VideoExportModal.tsx.
- Modify src/pages/EditorPage.tsx.
- Modify src/components/editor/EditorToolbar.tsx.
- Modify src/i18n/locales/en.json.
- Modify src/i18n/locales/vi.json.
- Modify src/i18n/locales/ja.json.

**Files that must remain unchanged:** src/components/editor/ExportModal.tsx, src/pages/ProjectDetailPage.tsx, src/utils/exporter.ts, src/utils/subtitleParsers.ts, src/hooks/useEditorDraft.ts, src/hooks/useSubtitleTrack.ts, src/context/ProcessingContext.tsx, and src/components/processing/FloatingProcessingWidget.tsx.

- [ ] In EditorPage, derive effective target subtitles locally from committed subtitles and the two active draft values. Preserve the current VTT preview and active-cue behavior based on committed subtitles.

- [ ] Apply a pending text draft when editingTextCueId matches and textDraft is not null, including an intentionally empty string. Ignore sourceDraft.

- [ ] Apply a pending timing draft only after checking trimmed values are non-empty, finite, start is at least 0, and end is greater than start. Track hasInvalidTimingDraft separately so the export button is disabled while the draft is invalid and no invalid SRT can be produced.

- [ ] Compute canExportVideo from video readiness, videoBlob, a video/* MIME type, non-empty effective subtitles, no invalid timing draft, and no active export. Treat audio/* as unavailable and do not offer conversion.

- [ ] Keep export state local to EditorPage:

  ~~~typescript
  type VideoExportStatus =
    | "idle"
    | "preparing"
    | "exporting"
    | "completed"
    | "error";
  ~~~

  Store status, progress, and a typed/localized error message. Do not use global processing state.

- [ ] Add a separate toolbar action and keep the existing subtitle Export action unchanged. Pass an explicit onExportVideo callback and exportVideoDisabled state to EditorToolbar. Do not merge MP4 into ExportModal.

- [ ] Implement the export handler so it:

  1. Opens the feature modal and sets preparing.
  2. Uses the already available videoBlob and effective target subtitles.
  3. Calls exportVideoWithSubtitles with a progress callback.
  4. Creates the exact download name <base-name>_subtitled.mp4.
  5. Calls existing saveAs only after a successful output Blob.
  6. Sets completed only after saveAs is requested; maps typed failures to localized messages and sets error.
  7. Never starts a second Drive fetch and never updates global processing state.

- [ ] Define VideoExportModal as a feature-specific component using existing ModalWrapper. Its props must cover open state, file name, preparing/exporting/completed/error status, progress, error text, close callback, and the current localized strings. It may render only the title, status text, progress indicator, error text, and close action required for this feature. Do not create a generic modal component or generic progress abstraction.

- [ ] Keep the modal open through completion/error so the user can read the result. Allow close after completion or error; do not add cancellation unless the existing modal contract already supplies it.

- [ ] Add only the editor locale keys required by this feature:

  English:

  ~~~json
  "exportVideo": "Export MP4",
  "videoExport": {
    "title": "Export video with subtitles",
    "preparing": "Preparing video export...",
    "exporting": "Rendering subtitles into video...",
    "completed": "Video exported successfully.",
    "noVideo": "The video is not ready for export.",
    "audioOnly": "Audio-only files cannot be exported as video.",
    "noSubtitles": "Add target subtitles before exporting.",
    "invalidTiming": "Finish the timing edit with valid values before exporting.",
    "loadError": "Could not load the video export engine.",
    "unsupportedError": "This video format is not supported for burned-in export.",
    "executionError": "Could not render subtitles into the video.",
    "outputError": "Could not read the exported MP4.",
    "close": "Close"
  }
  ~~~

  Vietnamese:

  ~~~json
  "exportVideo": "Xuất MP4",
  "videoExport": {
    "title": "Xuất video kèm phụ đề",
    "preparing": "Đang chuẩn bị xuất video...",
    "exporting": "Đang render phụ đề vào video...",
    "completed": "Đã xuất video thành công.",
    "noVideo": "Video chưa sẵn sàng để xuất.",
    "audioOnly": "Không thể xuất tệp chỉ có âm thanh thành video.",
    "noSubtitles": "Hãy thêm phụ đề bản dịch trước khi xuất.",
    "invalidTiming": "Hãy hoàn tất chỉnh sửa thời gian hợp lệ trước khi xuất.",
    "loadError": "Không thể tải bộ máy xuất video.",
    "unsupportedError": "Định dạng video này không hỗ trợ burn-in phụ đề.",
    "executionError": "Không thể render phụ đề vào video.",
    "outputError": "Không thể đọc file MP4 đã xuất.",
    "close": "Đóng"
  }
  ~~~

  Japanese must provide natural translations for the same keys and no other locale files should change.

- [ ] Run:

  ~~~text
  npm run lint
  npm run build
  git diff --check
  ~~~

- [ ] Review the diff to confirm the old subtitle ExportModal, ProjectDetailPage, subtitle exporter, draft hook, VTT preview hook, and global processing path were not modified.

- [ ] Commit only the approved UI/wiring files:

  ~~~text
  git add -- src/components/editor/VideoExportModal.tsx src/pages/EditorPage.tsx src/components/editor/EditorToolbar.tsx src/i18n/locales/en.json src/i18n/locales/vi.json src/i18n/locales/ja.json
  git commit -m "feat: add editor video subtitle export"
  ~~~

## Task 6: Regression and visual verification

- [ ] Run the complete repository checks:

  ~~~text
  npm run lint
  npm run build
  git diff --check
  ~~~

- [ ] Manually verify the effective-draft matrix in EditorPage:

  - Committed target text is exported.
  - Pending target text replaces the committed text, including an intentional empty string.
  - Pending source text does not change the MP4.
  - Valid pending timing replaces the committed timing.
  - Empty, non-numeric, negative-start, and end-at-or-before-start timing drafts disable export and never invoke FFmpeg.

- [ ] Manually verify media behavior:

  - A video with audio exports MP4 with readable audio and burned-in target captions.
  - A video without audio exports a playable video-only MP4 with burned-in target captions.
  - An audio-only input is rejected/disabled and is never converted.
  - The seven approved representative target strings render correctly.
  - The downloaded filename ends with _subtitled.mp4.

- [ ] Manually verify runtime safety:

  - Two rapid export clicks do not overlap FFmpeg operations.
  - Audio preprocessing and video export serialize against each other.
  - Temporary files are removed after success and failure.
  - A load, exec, output-read, or cleanup error still releases the mutex and a later operation can run.
  - Progress listener cleanup does not leak callbacks across exports.

- [ ] Regression-check existing behavior:

  - Video playback, seek, highlight, and subtitle autoscroll still work.
  - Save subtitles still works.
  - Existing SRT, VTT, TXT, target/source/bilingual exports still work.
  - ProjectDetailPage subtitle and ZIP exports are unchanged.
  - Global media processing behavior is unchanged.

- [ ] Use the existing browser/visual QA workflow to inspect the Editor route at desktop, laptop/tablet, and mobile widths in light and dark themes. Check modal layout, disabled/enabled toolbar state, progress state, completed state, error state, and no horizontal overflow. If authentication prevents access to the Editor route, record that limitation and complete all reachable checks.

- [ ] Perform a final scope review:

  ~~~text
  git status --short
  git diff --stat HEAD~5..HEAD
  rg -n "fallback|generic modal|capability service|useEffect.*probe|audio-only|libx264" src docs/superpowers/specs docs/superpowers/plans
  ~~~

  Confirm no new dependency, test framework, backend endpoint, persistent probe, generic modal abstraction, system encoder fallback, or unrelated boundary change was introduced.

## Completion Criteria

- The approved design spec is implemented without expanding scope.
- The capability gate has verified required libx264 subtitle rendering, audio-bearing output, video-only output, Unicode rendering, sequential locking, and cleanup.
- EditorPage exports only the effective target/translation track and downloads a valid MP4.
- Existing subtitle export, playback, project-detail, and global processing flows remain unchanged.
- Lint, build, diff whitespace checks, and the documented manual/visual regression checks pass.
