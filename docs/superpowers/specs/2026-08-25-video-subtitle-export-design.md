# Export MP4 Với Phụ Đề Target — Design Specification

**Status:** Proposed

**Milestone:** V1.1 — Client-side MP4 export with burned-in target subtitles

## Mục tiêu

Cho phép người dùng trong editor tải xuống một file MP4 mới, trong đó phụ đề target/translation hiện tại được render trực tiếp vào từng khung hình video. File xuất ra phải sử dụng dữ liệu subtitle editor hiện tại, kể cả các thay đổi chưa Save.

## Phạm vi

Milestone này chỉ hỗ trợ:

- Video Blob đang được editor tải về từ Google Drive.
- `subtitles: SubtitleItem[]` target hiện tại.
- Một hành động riêng: `Export video with subtitles`.
- Output MP4 được tải xuống bằng `file-saver` hiện có.
- Progress, trạng thái hoàn tất và lỗi export trong editor.

Milestone này không hỗ trợ:

- Source/original subtitles.
- Bilingual output.
- Tùy chỉnh font, màu, vị trí, animation hoặc ASS styling.
- Upload lên YouTube, TikTok, Facebook hoặc bất kỳ nền tảng nào.
- Thay native video player.
- Database schema, Supabase service hoặc Edge Function mới.
- Thêm `mp4` vào `SubtitleExportFormat` hoặc thay đổi subtitle file export hiện tại.
- Chunking video, background queue hoặc server-side rendering.

## Quyết định kiến trúc

### Phương án được chọn: tái sử dụng FFmpeg WASM hiện có trên client

Codebase đã có `@ffmpeg/ffmpeg`, `@ffmpeg/util` và một FFmpeg singleton trong `mediaAudioPreprocessor.ts`. Runtime này sẽ được tách thành module dùng chung để audio preprocessing và video export cùng sử dụng một worker đã load.

Luồng dữ liệu:

```text
Google Drive response
    ↓
useEditorVideo
    ├── videoUrl        → native <video> playback
    └── videoBlob       → video export

subtitles: SubtitleItem[]
    ↓
exportToSrt(subtitles)
    ↓
FFmpeg virtual filesystem
    ├── input media
    ├── subtitles.srt
    └── output.mp4
    ↓
Blob
    ↓
file-saver download
```

### Các phương án không chọn

1. Tạo FFmpeg instance riêng cho video export: bị loại vì phải load thêm worker/WASM và tạo hai lifecycle khác nhau.
2. Render ở Supabase Edge Function: bị loại khỏi milestone vì cần truyền video lên server, thêm giới hạn upload, chi phí và pipeline mới.
3. Render caption bằng canvas/custom player: bị loại vì không tạo được file MP4 và không tận dụng được FFmpeg hiện có.

## Capability gate trước khi triển khai UI

Trước khi thêm nút export hoặc modal, phải chạy probe với một video ngắn trên đúng FFmpeg core URL hiện tại. Probe phải xác nhận:

- filter `subtitles` tồn tại;
- encoder H.264 được hỗ trợ, ưu tiên `libx264`;
- encoder AAC tồn tại;
- MP4 muxer hoạt động;
- progress event phát ra trong lúc `exec()`;
- worker hiện tại có thể reuse cho job tiếp theo;
- input, SRT và output có thể xóa khỏi virtual filesystem.

Nếu bất kỳ capability nào không có, milestone dừng ở probe và không thêm UI dựa trên giả định. Không tự động thêm dependency hoặc chuyển sang backend trong cùng milestone.

## Module và interface

### `src/services/ffmpegRuntime.ts`

Chuyển phần loader singleton hiện có từ `mediaAudioPreprocessor.ts` sang module này:

```ts
export const getFfmpeg: () => Promise<FFmpeg>;
```

Module này giữ các quyết định hiện tại:

- `@ffmpeg/core@0.12.10` qua CDN hiện có;
- `toBlobURL()` cho core JS/WASM;
- promise singleton để reuse worker;
- reset promise khi load thất bại để lần sau có thể thử lại.

Không terminate worker sau mỗi job thành công. Việc terminate chỉ được cân nhắc khi có lỗi worker không thể phục hồi, và không thuộc flow bình thường của milestone.

### `src/hooks/useEditorVideo.ts`

Giữ nguyên `videoUrl` và các hành vi playback hiện tại, đồng thời trả thêm:

```ts
videoBlob: Blob | null;
```

`videoBlob` là Blob đã được tạo từ response media và có MIME type đã resolve. Khi media đổi hoặc hook unmount, hook không giữ reference tới Blob cũ; Object URL vẫn được revoke như trước.

### `src/services/videoSubtitleExporter.ts`

Exporter không biết về React, database hoặc router:

```ts
export interface VideoSubtitleExportOptions {
  videoBlob: Blob;
  videoMimeType: string;
  subtitles: SubtitleItem[];
  fileName: string;
  onProgress?: (progress: number) => void;
}

export const exportVideoWithSubtitles: (
  options: VideoSubtitleExportOptions
) => Promise<Blob>;
```

Trách nhiệm:

1. Reject sớm nếu Blob rỗng hoặc `subtitles.length === 0`.
2. Tạo tên file tạm an toàn từ file id/token và MIME type.
3. Ghi video input bằng `fetchFile(videoBlob)`.
4. Ghi nội dung `exportToSrt(subtitles)` thành `subtitles.srt`.
5. Đăng ký progress callback trước `ffmpeg.exec()` và gỡ callback trong `finally`.
6. Chạy một command burn-in với capability đã xác nhận, theo cấu trúc:

```text
-y
-i input
-map 0:v:0
-map 0:a?
-vf subtitles=subtitles.srt
-c:v libx264
-preset veryfast
-crf 23
-pix_fmt yuv420p
-c:a aac
-b:a 128k
-movflags +faststart
output.mp4
```

7. Đọc output thành `Uint8Array`, tạo `Blob` MIME `video/mp4` và trả về Blob.
8. Xóa input, SRT và output khỏi FFmpeg filesystem bằng `Promise.allSettled()` trong mọi trường hợp.

Các tên file tạm không chứa khoảng trắng hoặc ký tự cần escape. Không dùng `videoUrl` làm input chính.

### `src/components/editor/VideoExportModal.tsx`

Modal này chỉ dành cho video export, không tái sử dụng selection UI của `ExportModal.tsx`.

Props tối thiểu:

```ts
type VideoExportStatus = 'running' | 'success' | 'error';

interface VideoExportModalProps {
  isOpen: boolean;
  fileName: string;
  status: VideoExportStatus;
  progress: number;
  error: string | null;
  onClose: () => void;
}
```

Quy tắc UI:

- Khi `running`, hiển thị progress và không cho đóng modal.
- Khi `success`, hiển thị hoàn tất và cho phép đóng.
- Khi `error`, hiển thị lỗi generic đã dịch và cho phép đóng để thử lại.
- Không có cancel/retry tự động trong V1. Retry được thực hiện bằng cách bấm export lại.

### `EditorToolbar.tsx` và `EditorPage.tsx`

Thêm một action riêng cho video export, độc lập với subtitle file export:

- `EditorToolbar` nhận callback `onExportVideo` và trạng thái disabled.
- `EditorPage` giữ state export, gọi exporter với `videoBlob` và `subtitles` target hiện tại.
- Khi exporter trả về Blob, `EditorPage` gọi `saveAs()` với basename gốc đã bỏ extension và hậu tố `_with_subtitles.mp4`.
- Nút disabled khi đang export, chưa có video Blob hoặc chưa có target subtitles.
- Editor không yêu cầu Save trước khi export; output dùng state hiện tại.

## Progress và lỗi

Progress của FFmpeg được truyền qua `onProgress`. UI hiển thị giá trị giới hạn trong khoảng 0–100.

Các trường hợp lỗi cần xử lý:

- Video Blob không tồn tại hoặc rỗng: không gọi FFmpeg.
- Không có target subtitle: không gọi FFmpeg.
- FFmpeg load thất bại: giữ editor hoạt động và hiển thị lỗi export.
- Command trả exit code khác 0: không download output lỗi.
- Read output thất bại: coi export là lỗi và không download.
- Cleanup tạm thất bại sau khi output đã đọc: ghi log, vẫn kết thúc trạng thái export và không làm crash editor.
- Export đang chạy: chặn một job thứ hai.

Không thêm retry vô hạn, timeout tùy tiện, upload trung gian hoặc worker queue.

## File dự kiến

### Tạo mới

- `src/services/ffmpegRuntime.ts`
- `src/services/videoSubtitleExporter.ts`
- `src/components/editor/VideoExportModal.tsx`

### Sửa

- `src/services/mediaAudioPreprocessor.ts`
- `src/hooks/useEditorVideo.ts`
- `src/components/editor/EditorToolbar.tsx`
- `src/pages/EditorPage.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/vi.json`
- `src/i18n/locales/ja.json`

### Không sửa trong milestone

- `src/components/editor/ExportModal.tsx`
- `src/utils/exporter.ts`
- `src/utils/subtitleParsers.ts`
- `src/services/fileService.ts`
- `src/services/subtitleService.ts`
- database schema
- Supabase Edge Functions
- social publishing pipeline

## Verification và acceptance criteria

### Capability/runtime

- [ ] Probe xác nhận `subtitles` filter, H.264 encoder, AAC encoder và MP4 muxer.
- [ ] FFmpeg core chỉ load một lần trong session.
- [ ] Job success/error đều cleanup virtual filesystem.
- [ ] Progress listener được gỡ sau mỗi job.

### Export

- [ ] Video ngắn có target cue xuất ra MP4 mở được.
- [ ] Chữ target nằm trong pixel video, không phụ thuộc WebVTT track.
- [ ] Output không chứa source hoặc bilingual subtitles.
- [ ] Text và timing chưa Save được dùng đúng trong output.
- [ ] Tên file có hậu tố `_with_subtitles.mp4`.
- [ ] Không có subtitle hoặc video Blob thì không chạy export.
- [ ] Lỗi export không làm mất playback hoặc editor state.

### Regression

- [ ] Caption preview V1 vẫn hoạt động.
- [ ] Play, pause, seek, volume và fullscreen vẫn hoạt động.
- [ ] Save subtitle vẫn hoạt động.
- [ ] Export SRT/VTT/TXT target/source/bilingual vẫn hoạt động.
- [ ] Audio behavior hiện tại không bị refactor ngoài phạm vi.
- [ ] `npm run lint` không có lỗi mới.
- [ ] `npm run build` thành công.

## Out-of-scope follow-up

Sau khi milestone này ổn định mới đánh giá:

- lựa chọn source/bilingual;
- style caption nâng cao;
- giới hạn video lớn và background processing;
- social publishing.
