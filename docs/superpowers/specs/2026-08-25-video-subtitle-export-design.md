# Client-side MP4 Export With Burned-in Target Subtitles

## 1. Status

Implementation-ready design specification, revised against the current LTS.ai codebase.

## 2. Milestone

V1.1 — Client-side MP4 export with burned-in target subtitles.

## 3. Goal

Cho phép người dùng đang ở `EditorPage` tải xuống một file MP4 mới, trong đó phụ đề target/translation hiệu lực tại thời điểm export được render trực tiếp vào các khung hình video. Người dùng không cần Save trước khi export.

## 4. Scope

V1.1 chỉ xử lý:

- Video media đã được `useEditorVideo` tải từ Google Drive thành Blob.
- `effective target subtitles` của editor, gồm cả draft target text và timing hợp lệ chưa confirm.
- Một action riêng trong editor: export video có phụ đề.
- Burn-in target/translation subtitles bằng FFmpeg WASM hiện có.
- Download output MP4 bằng `file-saver` hiện có.
- Local progress, completed state và error state trong editor.

Video có hình nhưng không có audio vẫn được hỗ trợ và phải tạo video-only MP4. Audio-only input không được hỗ trợ: action phải disabled hoặc reject rõ ràng. Không chuyển MP3/audio thành MP4 video.

## 5. Out of Scope

Không triển khai trong milestone này:

- Burn-in source/original subtitles.
- Burn-in bilingual subtitles.
- Font, màu, kích thước, vị trí, animation hoặc ASS styling.
- Font manager, font upload hoặc font embedding system.
- Resolution, FPS, bitrate, CRF hoặc preset selector.
- Crop, watermark, audio track selector hoặc multiple audio processing.
- YouTube, TikTok, Facebook hoặc social upload.
- Server-side rendering, Supabase Edge Function, API endpoint hoặc media upload lại lên server.
- Background processing, global queue, pause/resume, cancellation framework, retry queue hoặc export history.
- Database schema, export record, storage table hoặc IndexedDB cache.
- Thay native video player.
- Thay đổi behavior của audio preprocessing.
- Thay đổi subtitle SRT/VTT/TXT export hoặc project ZIP export.

## 6. Current Codebase Constraints

### Dependency và FFmpeg

`package.json` hiện có:

- `@ffmpeg/ffmpeg: ^0.12.15`;
- `@ffmpeg/util: ^0.12.2`;
- `file-saver` và `@types/file-saver`.

Không thêm dependency và không thay version trong milestone này.

`src/services/mediaAudioPreprocessor.ts` hiện là nơi duy nhất dùng FFmpeg. File này có:

- `FFmpeg` singleton promise;
- core version `0.12.10`;
- CDN base URL `https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm`;
- `toBlobURL()` cho `ffmpeg-core.js` và `ffmpeg-core.wasm`;
- reset promise khi `load()` thất bại;
- audio extraction thành FLAC chunks và cleanup virtual filesystem.

Các giá trị và behavior trên phải được giữ nguyên. Refactor runtime chỉ nhằm cho phép video exporter dùng chung instance và không được thay đổi semantics của audio preprocessing.

### Video source

`src/hooks/useEditorVideo.ts` hiện:

1. lấy Google access token;
2. fetch media từ Google Drive;
3. tạo Blob có MIME type đã resolve;
4. tạo Object URL;
5. chỉ expose `videoUrl`, loading, error và current time.

Video export phải dùng chính Blob từ lần fetch này. Không fetch Google Drive lần thứ hai và không dùng `videoUrl` làm input chính cho FFmpeg.

### Subtitle state

`src/hooks/useEditorSubtitles.ts` quản lý `subtitles` target đã commit vào editor state.

`src/hooks/useEditorDraft.ts` quản lý riêng:

- `editingTimingCueId` và `timingDraft: { start: string; end: string } | null`;
- `editingTextCueId` và `textDraft: string | null`;
- `sourceDraft`, không được đưa vào MP4.

Khi người dùng đang nhập text hoặc timing nhưng chưa confirm, dữ liệu draft chưa nằm trong `subtitles`. Export phải ghép hai nguồn này thành effective target subtitles mà không Save và không persistence draft.

### Existing subtitle export

`src/utils/subtitleParsers.ts` đã có `exportToSrt`, `exportToVtt`, `exportToTxt`.

`src/utils/exporter.ts` đã có:

```ts
type SubtitleExportFormat = 'srt' | 'vtt' | 'txt';
type SubtitleExportTrack = 'target' | 'source' | 'bilingual';
```

Không thêm `mp4` vào `SubtitleExportFormat` và không thay đổi behavior hiện tại.

### Existing UI boundaries

`src/components/editor/ExportModal.tsx` phục vụ subtitle file export và đang được dùng ở cả:

- `EditorPage.tsx`;
- `ProjectDetailPage.tsx`.

MP4 burn-in chỉ khả dụng tại `EditorPage`. `ProjectDetailPage` và project ZIP export không được tự nhiên có thêm chức năng này.

`ProcessingContext`, `useGlobalProcessing` và `FloatingProcessingWidget` phục vụ media processing hiện tại. Video export là local editor operation, không được đưa vào global processing state.

Project hiện không có test framework chuyên biệt. Không thêm Jest, Vitest hoặc Playwright chỉ cho milestone này.

## 7. Current Relevant Architecture

Playback hiện tại:

```text
Google Drive
    ↓
useEditorVideo
    ↓
Blob + Object URL
    ↓
VideoPlayer native <video>
```

Caption preview hiện tại:

```text
subtitles: SubtitleItem[]
    ↓
useSubtitleTrack
    ↓
exportToVtt()
    ↓
VTT Blob URL
    ↓
native <track>
```

VTT Blob URL chỉ phục vụ preview trong native player. Không dùng VTT track làm input cho FFmpeg.

Video export mới:

```text
video Blob từ useEditorVideo
    + effective target subtitles từ EditorPage
    ↓
exportToSrt()
    ↓
shared FFmpeg instance
    ↓
MP4 Blob
    ↓
file-saver download
```

## 8. Required Changes

### 8.1. Expose Blob từ `useEditorVideo`

Mở rộng return value của `useEditorVideo` bằng:

```ts
videoBlob: Blob | null;
```

Giữ nguyên `videoUrl`, playback, loading, error, current time và Object URL cleanup. Khi media được tải, lưu đúng Blob đã dùng để tạo Object URL. Khi media đổi hoặc hook unmount, không giữ reference tới Blob cũ.

Không thêm fetch function riêng cho export.

### 8.2. Tạo shared FFmpeg runtime tối thiểu

Tạo module dùng chung:

```text
src/services/ffmpegRuntime.ts
```

Module này chứa loader singleton được di chuyển nguyên behavior từ `mediaAudioPreprocessor.ts` và expose tối thiểu:

```ts
getFfmpeg(): Promise<FFmpeg>
acquireFfmpegLock(): Promise<() => void>
```

`acquireFfmpegLock()` là mutex tối thiểu để đảm bảo không có hai `ffmpeg.exec()` concurrent trên cùng instance. Lock bao phủ toàn bộ FFmpeg filesystem/`exec()` lifecycle của một operation: acquire trước `getFfmpeg()` và mọi `writeFile`/`readFile`/`exec`, giữ qua output read, và release sau cleanup. Mọi release phải nằm trong `finally`. Không tạo worker pool, queue framework hoặc generic job manager.

`extractFlacChunks()` phải giữ lock trong toàn bộ lifecycle async generator, từ trước khi lấy instance tới `finally` cleanup; video exporter cũng phải giữ lock theo cùng quy tắc. Như vậy audio preprocessing và video export không chạy cùng lúc trên FFmpeg FS/worker. Việc này chỉ serialize execution và không đổi kết quả audio.

### 8.3. Tạo video export service tối thiểu

Tạo:

```text
src/services/videoSubtitleExporter.ts
```

Service không biết về React, router, database, Supabase hoặc Google Drive.

Interface đề xuất:

```ts
interface VideoSubtitleExportOptions {
  videoBlob: Blob;
  subtitles: SubtitleItem[];
  fileName: string;
  onProgress?: (progress: number) => void;
}

exportVideoWithSubtitles(
  options: VideoSubtitleExportOptions
): Promise<Blob>
```

Service phải:

1. reject sớm nếu Blob rỗng, Blob không phải video hoặc subtitles rỗng;
2. tạo UTF-8 SRT từ `exportToSrt(subtitles)`;
3. ghi input media và SRT vào FFmpeg virtual filesystem;
4. chạy burn-in command theo output policy ở Section 14;
5. đọc output thành MP4 Blob;
6. cleanup tất cả file tạm trong `finally`;
7. gỡ progress listener trong `finally`;
8. trả Blob cho UI, không tự download và không upload.

Không tạo SRT exporter thứ hai.

### 8.4. Tính effective target subtitles tại `EditorPage`

Không thay đổi `useEditorDraft` architecture và không tạo global state.

Tại `EditorPage`, tạo derived value local từ:

- `subtitles`;
- `editingTimingCueId`;
- `timingDraft`;
- `editingTextCueId`;
- `textDraft`.

Quy tắc:

- bắt đầu từ committed `subtitles`;
- nếu `editingTextCueId` trùng cue và `textDraft !== null`, dùng `textDraft`, kể cả chuỗi rỗng;
- nếu `editingTimingCueId` trùng cue và start/end parse thành số hữu hạn, `start >= 0`, `end > start`, dùng timing draft;
- nếu timing draft đang invalid, disable export và yêu cầu người dùng hoàn tất timing hợp lệ;
- luôn bỏ qua `sourceDraft`;
- không Save và không gọi subtitle service.

Derived value này được dùng cho MP4 export. `useSubtitleTrack` và active cue hiện tại tiếp tục dùng `subtitles` committed như behavior preview hiện tại.

## 9. Data Flow

```text
useEditorVideo fetch một lần
    ├── videoBlob → availability + exporter
    └── videoUrl  → VideoPlayer playback

useEditorSubtitles + useEditorDraft
    ↓
effectiveTargetSubtitles
    ↓
exportToSrt(effectiveTargetSubtitles)
    ↓
videoSubtitleExporter
    ↓
shared FFmpeg runtime + lock
    ↓
output MP4 Blob
    ↓
EditorPage gọi saveAs()
```

Không có database write, network upload hoặc Google Drive re-fetch trong flow này.

## 10. Effective Subtitle State

Effective target subtitles là dữ liệu dùng cho export tại đúng thời điểm user bấm action.

Ví dụ một cue committed:

```ts
{
  id: 1,
  start: 0,
  end: 2.5,
  text: 'Xin chào'
}
```

Nếu user đang nhập `textDraft = 'Xin chào mọi người'` nhưng chưa confirm, effective cue phải là:

```ts
{
  id: 1,
  start: 0,
  end: 2.5,
  text: 'Xin chào mọi người'
}
```

Nếu user đang nhập timing hợp lệ `start = '1.25'`, `end = '4'`, timing effective phải là `1.25 → 4` dù chưa Save.

Source draft không bao giờ đi vào effective target subtitles.

Nếu timing draft invalid, không cố tạo SRT invalid và không chạy FFmpeg; action phải disabled cho tới khi draft hợp lệ hoặc bị hủy.

## 11. Shared FFmpeg Runtime

Runtime mới phải giữ nguyên:

- package versions hiện tại;
- core version `0.12.10`;
- CDN URL hiện tại;
- `toBlobURL()`;
- singleton promise;
- reset promise khi load fail.

Không tạo instance thứ hai cho video exporter.

Mutex tối thiểu phải đảm bảo:

- audio preprocessing giữ lock trong toàn bộ `extractFlacChunks()` lifecycle;
- video exporter giữ lock từ trước `getFfmpeg()`/file writes tới sau cleanup;
- job thứ hai chờ job thứ nhất hoàn tất;
- không có concurrent `ffmpeg.exec()`;
- không tích hợp lock với `ProcessingContext`.

## 12. Video Export Pipeline

Pipeline service:

1. Validate Blob là video và có bytes.
2. Validate effective target subtitles không rỗng.
3. Tạo invocation id đơn giản để tránh collision filename.
4. `fetchFile(videoBlob)` và `ffmpeg.writeFile(inputName, ...)`.
5. Encode `exportToSrt(subtitles)` thành UTF-8 bytes và ghi `subtitleName`.
6. Attach `ffmpeg.on('progress', handler)`.
7. Chạy một `ffmpeg.exec()` với args policy cố định.
8. Nếu exit code khác 0, throw execution error.
9. Đọc output file thành `Uint8Array`.
10. Tạo `new Blob([data], { type: 'video/mp4' })`.
11. Detach progress listener và cleanup trong `finally`.

Service không tự gọi `saveAs()` để giữ UI/download boundary tại `EditorPage`.

## 13. FFmpeg Capability Probe

Trước khi expose UI, phải chạy một probe thực tế một lần trên đúng core URL hiện tại với một video ngắn có audio nếu có thể. Đây là bước validation thủ công/development trước implementation, không phải runtime capability service. Không chạy probe trong mỗi render, mỗi `EditorPage` mount hoặc mỗi lần export; không thêm `useEffect` probe, cache persistent hoặc API probe vào production flow. Probe không được chỉ kiểm tra string/config.

Probe phải xác nhận:

1. FFmpeg load thành công.
2. `subtitles` filter execute thành công.
3. Encoder `libx264` bắt buộc dùng cho output và execute thành công.
4. AAC encoder hoạt động khi input có audio.
5. MP4 muxer tạo output đọc được.
6. Output có bytes và MIME `video/mp4`.
7. Progress event phát ra và listener có thể gỡ.
8. Input/SRT/output đều delete được.
9. Cùng FFmpeg instance chạy được job export thứ hai tuần tự.
10. Unicode subtitle rendering hoạt động với tối thiểu tiếng Việt, tiếng Nhật và tiếng Trung.
11. Input không có audio vẫn tạo được video-only MP4 theo Section 14.

Có thể dùng fixture video ngắn hiện có trong `public/landing-video.mp4` nếu codec/audio phù hợp; nếu fixture không đủ để kiểm tra audio, probe phải dùng một video media ngắn có audio trong môi trường test, không thêm fixture production chỉ cho probe.

Nếu Unicode không render đúng vì font capability của core, ghi nhận capability gap và dừng trước UI. Không thêm font system, dependency hoặc backend workaround trong milestone này.

## 14. Output/Codec Policy

Output policy cố định, không có settings panel:

- container: MP4;
- video: `libx264` là capability bắt buộc và là encoder duy nhất được phép dùng trong V1.1;
- audio: AAC nếu input có audio;
- subtitle: `subtitles` filter burn-in vào video frames;
- không có audio input: output video-only MP4, không tạo audio giả;
- giữ resolution input bằng cách không thêm scale filter;
- giữ frame rate input bằng cách không thêm FPS filter;
- giữ audio presence, chỉ re-encode audio nếu có;
- pixel format output: `yuv420p` để tăng compatibility;
- fixed quality/performance flags: `-preset veryfast`, `-crf 23`, `-b:a 128k`, không expose ra UI;
- dùng `-movflags +faststart`;
- map video stream đầu tiên và audio stream optional (`0:a?`).

Command structure phải tương đương:

```text
-y
-i <input>
-map 0:v:0
-map 0:a?
-vf subtitles=<srt-file>
-c:v libx264
-preset veryfast
-crf 23
-pix_fmt yuv420p
-c:a aac
-b:a 128k
-movflags +faststart
<output.mp4>
```

Nếu capability probe không có hoặc không chạy được `libx264`, ghi nhận capability gap và dừng milestone trước khi expose UI. Không tạo encoder fallback, không tự đổi sang encoder H.264 khác và không thêm conversion policy mới.

## 15. Temporary File and Cleanup Policy

Do FFmpeg instance được reuse, file names phải có invocation id, ví dụ:

```text
export-<id>-input.<ext>
export-<id>-subtitles.srt
export-<id>-output.mp4
```

Tên file chỉ dùng token an toàn `[A-Za-z0-9_-]` và extension media đã resolve từ Blob type.

Cleanup nằm trong `finally` và phải thử xóa:

- input;
- subtitle file;
- output file.

Cleanup success/error dùng `Promise.allSettled()` để một file thiếu không ngăn cleanup các file còn lại. Nếu output đã đọc thành công nhưng cleanup một file thất bại, ghi log và vẫn trả output Blob; nếu output read thất bại, export là error và không download.

Không tạo temp file manager hoặc cache layer.

## 16. UI Behavior

### Export action

Chỉ `EditorPage` có action MP4. `ProjectDetailPage` giữ nguyên subtitle export/ZIP export.

`ExportModal.tsx` hiện tại giữ nguyên vì nó là modal chọn target/source/bilingual và SRT/VTT/TXT. MP4 action là một nút riêng trong `EditorToolbar`, sử dụng một modal progress mỏng riêng dựa trên `ModalWrapper`; không tạo modal framework mới.

Nút video export phải:

- hiển thị rõ là export video có target subtitles;
- không có lựa chọn source/bilingual;
- không thêm `mp4` vào format list hiện tại;
- disabled khi video đang loading hoặc error;
- disabled khi subtitles đang loading hoặc error;
- disabled khi input là audio-only;
- disabled khi không có effective target subtitles;
- disabled khi timing draft invalid;
- disabled trong lúc export đang chạy.

### Local state

`EditorPage` dùng local state tối thiểu:

```text
idle → preparing → exporting → completed
                         └──→ error
```

Progress nằm trong khoảng 0–100. Không đưa state vào `ProcessingContext`, `FloatingProcessingWidget` hoặc database.

### Modal

Modal video export hiển thị:

- tên file input;
- trạng thái preparing/exporting/completed/error;
- progress khi đang chạy;
- lỗi đã phân loại khi thất bại;
- nút đóng sau completed/error.

Trong lúc chạy không cho đóng modal và không cho khởi động job thứ hai. V1.1 không hỗ trợ cancel, pause hoặc resume.

### Download

Khi nhận output Blob, `EditorPage` gọi `saveAs()` với basename gốc đã bỏ extension và tên:

```text
<base-name>_subtitled.mp4
```

Không đổi `file_name` trong database và không rename file trên Google Drive.

## 17. Progress/Error Handling

### Progress

Service đăng ký progress callback bằng API `FFmpeg.on('progress', ...)` trước `exec()` và gỡ bằng `off()` trong `finally`. `EditorPage` map progress vào local state; không tạo progress item global.

### Error categories

Không tạo error hierarchy phức tạp. Nếu cần phân biệt cho UI, dùng một error object đơn giản có `kind` thuộc:

```text
load | unsupported | execution | output
```

Ý nghĩa:

- `load`: FFmpeg core/worker không load được;
- `unsupported`: capability hoặc loại input không được hỗ trợ;
- `execution`: command burn-in trả lỗi;
- `output`: không đọc được output MP4.

Cleanup failure sau khi đã đọc output chỉ log, không override success. Các lỗi trước output read phải không tạo download.

Không retry vô hạn, không telemetry mới và không ghi media lên server để debug.

## 18. Validation/Acceptance Criteria

### Runtime/capability

- [ ] Probe trên core `0.12.10` load thành công.
- [ ] `subtitles` filter chạy thành công.
- [ ] `libx264` bắt buộc chạy thành công; không có encoder fallback.
- [ ] AAC và MP4 muxer chạy thành công.
- [ ] Unicode Việt/Nhật/Trung render đúng hoặc capability gap được ghi nhận trước UI.
- [ ] Progress event hoạt động và listener được gỡ.
- [ ] Job thứ hai chạy được trên cùng instance sau job đầu.
- [ ] Input/SRT/output được cleanup khi success và error.
- [ ] Audio preprocessing hiện tại vẫn cho kết quả như trước.

### Editor/export

- [ ] Editor chỉ cho export khi video Blob đã sẵn sàng và là video.
- [ ] Không có target subtitles thì không gọi FFmpeg và UI nêu rõ lý do.
- [ ] Target text committed được burn-in.
- [ ] Pending target text draft chưa confirm được burn-in.
- [ ] Pending timing draft hợp lệ chưa confirm được burn-in.
- [ ] Timing draft invalid chặn export, không tạo SRT invalid.
- [ ] Source text/source draft không xuất hiện trong output.
- [ ] Không cần Save trước export.
- [ ] Output là MP4 có suffix `_subtitled.mp4`.
- [ ] Mở output bằng player không có WebVTT track vẫn thấy chữ trong hình.
- [ ] Video có audio giữ được audio.
- [ ] Video không có audio vẫn tạo được video-only MP4.
- [ ] Audio-only input bị disabled hoặc reject rõ ràng và không tạo MP4.
- [ ] Export lỗi hiển thị error và editor/playback vẫn hoạt động.
- [ ] Double click không tạo concurrent export.

### Regression

- [ ] Caption preview native VTT V1 vẫn hoạt động.
- [ ] Play, pause, seek, volume, fullscreen và exit fullscreen vẫn hoạt động.
- [ ] Active cue, seek từ cue list và auto-scroll vẫn hoạt động.
- [ ] Save subtitle và Ctrl/Cmd + S vẫn hoạt động.
- [ ] SRT, VTT, TXT target/source/bilingual vẫn hoạt động.
- [ ] ProjectDetailPage và project ZIP export không có MP4 burn-in mới.
- [ ] Không có database/backend/Google Drive upload thay đổi.
- [ ] `npm run lint` pass.
- [ ] `npm run build` pass.

## 19. Explicit Non-Goals

Feature này không biến LTS.ai thành video rendering platform. Không có job manager, global queue, worker pool, cloud renderer, persistent export state, social publishing, style editor hoặc media conversion suite.

Mọi capability ngoài target-only MP4 burn-in phải là milestone riêng sau khi V1.1 ổn định.

## 20. File Change Boundaries

### Tạo mới

- `src/services/ffmpegRuntime.ts` — shared loader và mutex tối thiểu để audio preprocessing và video export reuse/serialize cùng instance.
- `src/services/videoSubtitleExporter.ts` — service client-side nhận Blob + effective target subtitles và trả MP4 Blob.
- `src/components/editor/VideoExportModal.tsx` — component UI riêng cho feature, hiển thị progress/error và dùng `ModalWrapper` hiện có; không tạo generic modal abstraction.

### Sửa

- `src/services/mediaAudioPreprocessor.ts` — chỉ đổi import/runtime lock; giữ nguyên audio processing command và output.
- `src/hooks/useEditorVideo.ts` — expose Blob đã fetch, không thêm fetch pipeline.
- `src/pages/EditorPage.tsx` — tính effective target subtitles, availability, local export state và download.
- `src/components/editor/EditorToolbar.tsx` — thêm action video export nếu cần để expose trong editor.
- `src/i18n/locales/en.json`;
- `src/i18n/locales/vi.json`;
- `src/i18n/locales/ja.json` — chỉ thêm translation keys cần cho action/progress/error.

### Không sửa

- `src/hooks/useEditorSubtitles.ts`;
- `src/hooks/useEditorDraft.ts`;
- `src/hooks/useSubtitleTrack.ts`;
- `src/components/editor/ExportModal.tsx`;
- `src/pages/ProjectDetailPage.tsx`;
- `src/utils/exporter.ts`;
- `src/utils/subtitleParsers.ts`;
- `src/services/fileService.ts`;
- `src/services/subtitleService.ts`;
- `src/context/ProcessingContext.tsx`;
- `src/components/common/FloatingProcessingWidget.tsx`;
- database schema, Supabase services, Edge Functions và Google Drive logic.

Mọi file ngoài các boundary trên chỉ được thay đổi nếu build hoặc capability probe chứng minh có blocker trực tiếp; khi đó phải cập nhật spec trước khi mở rộng phạm vi.
