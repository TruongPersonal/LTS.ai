import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const diagramsDir = path.resolve(rootDir, 'docs', 'diagrams');

if (!fs.existsSync(diagramsDir)) {
  fs.mkdirSync(diagramsDir, { recursive: true });
}

const diagrams = [
  {
    name: 'Hinh_2_1_Use_Case_Tong_Quat',
    title: 'Hình 2.1: Biểu đồ Use Case tổng quát của LTS.ai',
    code: `
graph TB
    subgraph "Hệ thống LTS.ai"
        subgraph "Xác thực"
            UC1["Đăng nhập Google OAuth"]
            UC2["Đăng xuất"]
        end
        subgraph "Quản lý dự án"
            UC3["Tạo dự án"]
            UC4["Sửa dự án"]
            UC5["Xóa dự án"]
            UC6["Xem danh sách dự án"]
        end
        subgraph "Quản lý tệp"
            UC7["Chọn media từ Google Drive"]
            UC8["Đính kèm phụ đề SRT/VTT"]
            UC9["Đổi tên tệp"]
            UC10["Xóa tệp"]
        end
        subgraph "Xử lý phụ đề"
            UC11["Tạo phụ đề từ media (Whisper)"]
            UC12["Dịch phụ đề đa ngôn ngữ (Gemini)"]
        end
        subgraph "Biên tập"
            UC13["Sửa nội dung phụ đề"]
            UC14["Sửa mốc thời gian"]
            UC15["Thêm / Xóa cue"]
        end
        subgraph "Xuất kết quả"
            UC16["Xuất SRT / VTT / TXT"]
            UC17["Đóng gói ZIP dự án"]
        end
    end
    User(("Người dùng")) --> UC1
    User --> UC2
    User --> UC3
    User --> UC4
    User --> UC5
    User --> UC6
    User --> UC7
    User --> UC8
    User --> UC9
    User --> UC10
    User --> UC11
    User --> UC12
    User --> UC13
    User --> UC14
    User --> UC15
    User --> UC16
    User --> UC17
    `,
  },
  {
    name: 'Hinh_2_2_Kien_Truc_He_Thong',
    title: 'Hình 2.2: Kiến trúc tổng thể của hệ thống LTS.ai',
    code: `
graph TB
    subgraph "Trình duyệt (Client)"
        UI["React 19 + TypeScript<br/>Tailwind CSS v4<br/>i18next (VI / EN / JA)"]
        FF["FFmpeg.wasm<br/>(Tách & nén audio FLAC 16kHz Mono)"]
        GP["Google Picker API<br/>(Chọn tệp media từ Drive)"]
    end

    subgraph "Supabase (Backend Serverless)"
        AUTH["Supabase Auth<br/>(Google OAuth 2.0 + JWT)"]
        DB["PostgreSQL (schema lts_ai)<br/>• profiles • projects<br/>• files_media • subtitles"]
        RLS["Row Level Security (RLS)"]
        EF["Edge Functions (Deno / TypeScript)<br/>• process-media"]
    end

    subgraph "Dịch vụ AI & Lưu trữ bên ngoài"
        GROQ["Groq API<br/>Whisper v3-turbo ➔ v3 fallback"]
        GEMINI["Google Gemini API<br/>3.5 Flash ➔ 3.6 ➔ 3.5 Lite ➔ 3.1 Lite"]
        DRIVE["Google Drive API<br/>(files.get alt=media)"]
    end

    UI <-->|"Supabase JS SDK (JWT Auth)"| DB
    UI <-->|"signInWithOAuth"| AUTH
    UI -->|"FLAC Chunks (multipart)"| EF
    UI -->|"Batch Cues (JSON)"| EF
    EF -->|"GROQ_API_KEY"| GROQ
    EF -->|"GEMINI_API_KEY"| GEMINI
    GP <-->|"Access Token"| DRIVE
    UI <-->|"Tải media trực tiếp"| DRIVE
    DB --- RLS
    `,
  },
  {
    name: 'Hinh_2_3_ERD_Co_So_Du_Lieu',
    title: 'Hình 2.3: Biểu đồ quan hệ thực thể (ERD) 4 bảng dữ liệu',
    code: `
erDiagram
    PROFILES ||--o{ PROJECTS : "1 - N (user_id)"
    PROJECTS ||--o{ FILES_MEDIA : "1 - N (project_id)"
    FILES_MEDIA ||--o{ SUBTITLES : "1 - N (file_id)"

    PROFILES {
        UUID id PK "FK to auth.users"
        TEXT email
        TEXT full_name
        INT daily_processed_seconds
        DATE last_processed_date
        TIMESTAMPTZ created_at
    }

    PROJECTS {
        UUID id PK
        UUID user_id FK
        TEXT title
        TEXT description
        TEXT target_language "CHECK: vi, en, zh, ja, ko, fr, it"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    FILES_MEDIA {
        UUID id PK
        UUID project_id FK
        TEXT drive_file_id
        TEXT file_name
        TEXT mime_type
        INT duration_seconds
        TEXT detected_source_lang
        TEXT status "draft, queued, processing, completed, failed"
        TEXT input_source "media, existing_subtitle"
        TEXT error_message
        TIMESTAMPTZ created_at
    }

    SUBTITLES {
        UUID id PK
        UUID file_id FK
        TEXT language
        JSONB content "Array of {id, start, end, text}"
        BOOLEAN is_edited
        TIMESTAMPTZ updated_at
    }
    `,
  },
  {
    name: 'Hinh_2_4_Activity_Xu_Ly_Media',
    title: 'Hình 2.4: Sơ đồ hoạt động luồng xử lý media và tạo phụ đề tự động',
    code: `
graph TD
    Start([Bắt đầu]) --> SelectFile[Chọn tệp video/audio từ Google Drive]
    SelectFile --> CheckSize{Kích thước <= 500MB?}
    CheckSize -->|Không| RejectSize[Báo lỗi vượt quá 500MB]
    RejectSize --> EndFail([Kết thúc])
    CheckSize -->|Có| CreateDraft[Tạo bản ghi files_media status: draft]
    CreateDraft --> UserClick[Người dùng nhấn nút Xử lý]
    UserClick --> SetQueued[Cập nhật status: queued]
    SetQueued --> SetProcessing[Cập nhật status: processing]
    SetProcessing --> DownloadDrive[Tải media từ Google Drive]
    DownloadDrive --> CheckQuota{Tổng thời lượng trong ngày + tệp <= 3600s?}
    CheckQuota -->|Không| QuotaFail[Báo lỗi vượt hạn mức 60 phút/ngày]
    QuotaFail --> MarkFailed[Cập nhật status: failed]
    CheckQuota -->|Có| FFmpegConvert[FFmpeg.wasm: Tách audio & nén FLAC 16kHz Mono]
    FFmpegConvert --> FFmpegChunk[Chia thành các đoạn 420s <= 19.5MB]
    FFmpegChunk --> Transcribe[Gửi đoạn FLAC đến Edge Function -> Groq Whisper]
    Transcribe --> MergeChunks[Ghép các đoạn cue, chuẩn hóa timing liên tục]
    MergeChunks --> SaveSource[Lưu phụ đề nguồn vào bảng subtitles]
    SaveSource --> BatchTranslate[Chia phụ đề thành các lô <= 100 câu]
    BatchTranslate --> GeminiAPI[Edge Function gọi Gemini 3.x Flash dịch thuật]
    GeminiAPI --> MapTiming[Ánh xạ text dịch với start/end của câu nguồn]
    MapTiming --> SaveTarget[Lưu phụ đề đích vào bảng subtitles]
    SaveTarget --> CompleteFile[Cập nhật files_media status: completed]
    CompleteFile --> EndSuccess([Hoàn thành sẵn sàng biên tập])
    `,
  },
  {
    name: 'Hinh_2_5_Activity_Phu_De_Co_San',
    title: 'Hình 2.5: Sơ đồ hoạt động luồng xử lý khi đính kèm phụ đề có sẵn (SRT/VTT)',
    code: `
graph TD
    Start([Bắt đầu]) --> SelectMedia[Chọn media trên Google Drive]
    SelectMedia --> AttachSub[Đính kèm tệp SRT hoặc VTT & chọn ngôn ngữ nguồn]
    AttachSub --> ParseClient[Client parse nội dung SRT/VTT thành danh sách cue]
    ParseClient --> SaveSourceDB[Lưu phụ đề nguồn vào CSDL với is_edited = false]
    SaveSourceDB --> MarkExisting[Ghi nhận files_media input_source: existing_subtitle]
    MarkExisting --> RunQueue[Chạy hàng đợi xử lý dự án]
    RunQueue --> CheckLang{Ngôn ngữ nguồn == Ngôn ngữ đích?}
    CheckLang -->|Trùng nhau| ReuseSub[Sử dụng trực tiếp bản nguồn làm bản dịch]
    CheckLang -->|Khác nhau| BatchTranslate[Chia thành các lô 100 câu -> Gemini API]
    ReuseSub --> SaveCompleted[Lưu phụ đề đích & cập nhật status: completed]
    BatchTranslate --> SaveCompleted
    SaveCompleted --> OpenEditor([Mở trình biên tập phụ đề song ngữ])
    `,
  },
  {
    name: 'Hinh_2_6_Sequence_Nhan_Dang_Dich',
    title: 'Hình 2.6: Biểu đồ tuần tự (Sequence Diagram) tạo và dịch phụ đề',
    code: `
sequenceDiagram
    actor U as Người dùng
    participant C as Trình duyệt (React)
    participant F as FFmpeg.wasm
    participant E as Supabase Edge Function
    participant G as Groq API (Whisper)
    participant M as Google Gemini API
    participant D as Google Drive API
    participant S as PostgreSQL (lts_ai)

    U->>C: Nhấn "Xử lý tệp"
    C->>S: UPDATE files_media SET status='processing'
    C->>D: GET /drive/v3/files/{id}?alt=media
    D-->>C: Media Blob Data
    C->>F: Tách âm thanh & nén FLAC 16kHz Mono
    F-->>C: Danh sách các đoạn FLAC (420s)

    loop Cho từng đoạn FLAC
        C->>E: POST /process-media (transcribe_chunk, FLAC, offset)
        E->>G: POST /audio/transcriptions (whisper-large-v3-turbo)
        alt Turbo thành công
            G-->>E: {language, segments: [{start, end, text}]}
        else Turbo lỗi (Cascade)
            E->>G: Fallback: whisper-large-v3
            G-->>E: {language, segments}
        end
        E-->>C: {source_language, subtitles[]}
    end

    C->>C: mergeTranscriptionChunks() (Sắp xếp, lọc, đánh số id)
    C->>S: UPSERT subtitles (ngôn ngữ nguồn)

    loop Cho từng lô <= 100 câu
        C->>E: POST /process-media (translate-batch, cues, src, tgt)
        E->>M: POST /models/gemini-3.5-flash:generateContent
        alt 3.5 Flash thành công
            M-->>E: JSON {subtitles: [{id, start, end, text}]}
        else Fallback Cascade (3.6 -> 3.5 Lite -> 3.1 Lite)
            E->>M: Thử model Gemini tiếp theo
            M-->>E: JSON kết quả
        end
        E-->>C: {subtitles: translated_cues[]}
    end

    C->>C: Ánh xạ text dịch & bảo toàn timing gốc
    C->>S: UPSERT subtitles (ngôn ngữ đích)
    C->>S: UPDATE files_media SET status='completed'
    C-->>U: Hiển thị thông báo hoàn thành
    `,
  },
  {
    name: 'Hinh_2_7_State_Trang_Thai_Tep',
    title: 'Hình 2.7: Sơ đồ máy trạng thái (State Diagram) của tệp media',
    code: `
stateDiagram-v2
    [*] --> draft : Người dùng nạp tệp từ Google Drive
    draft --> queued : Nhấn nút Bắt đầu xử lý
    queued --> processing : Hàng đợi lấy tệp ra xử lý lần lượt
    processing --> completed : Tách audio + Nhận dạng + Dịch thành công
    processing --> failed : Lỗi quá dung lượng 500MB / Hết quota / API lỗi
    failed --> queued : Nhấn Xử lý lại (Retry)
    completed --> [*] : Sẵn sàng Biên tập & Xuất phụ đề
    `,
  },
  {
    name: 'Hinh_2_8_AI_Cascade_Du_Phong',
    title: 'Hình 2.8: Sơ đồ kiến trúc AI Cascade dự phòng kép',
    code: `
graph LR
    subgraph "1. Nhận dạng giọng nói (Groq Speech-to-Text)"
        W1["Ưu tiên 1:<br/>whisper-large-v3-turbo<br/>(Tốc độ siêu tốc)"] -->|Nếu gặp sự cố| W2["Dự phòng 2:<br/>whisper-large-v3<br/>(Độ chính xác tối đa)"]
        W2 -->|Cả 2 lỗi| WFail["Ghi nhận lỗi & lưu error_message"]
    end

    subgraph "2. Dịch thuật phụ đề (Google Gemini AI - 1M TPM)"
        G1["Ưu tiên 1:<br/>gemini-3.5-flash"] -->|Lỗi/Nghẽn| G2["Dự phòng 2:<br/>gemini-3.6-flash"]
        G2 -->|Lỗi/Nghẽn| G3["Dự phòng 3:<br/>gemini-3.5-flash-lite"]
        G3 -->|Lỗi/Nghẽn| G4["Dự phòng 4:<br/>gemini-3.1-flash-lite"]
        G4 -->|Tất cả lỗi| GFail["Ghi nhận lỗi dịch"]
    end
    `,
  },
];

async function main() {
  console.log('🌐 Launching Chromium browser to render Mermaid diagrams...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: 2, // HiDPI Retina quality
  });

  for (const diagram of diagrams) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
        <style>
          body {
            margin: 0;
            padding: 40px;
            background: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .title {
            font-size: 16px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 24px;
            text-align: center;
          }
          .mermaid {
            background: #ffffff;
          }
        </style>
      </head>
      <body>
        <div class="mermaid">
          ${diagram.code}
        </div>
        <script>
          mermaid.initialize({
            startOnLoad: true,
            theme: 'neutral',
            themeVariables: {
              primaryColor: '#e0e7ff',
              primaryTextColor: '#1e1b4b',
              primaryBorderColor: '#6366f1',
              lineColor: '#4f46e5',
              secondaryColor: '#f1f5f9',
              tertiaryColor: '#ffffff',
              fontSize: '14px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
            }
          });
        </script>
      </body>
      </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const mermaidElement = page.locator('.mermaid svg').first();
    const dest = path.join(diagramsDir, `${diagram.name}.png`);

    if (await mermaidElement.isVisible()) {
      const box = await mermaidElement.boundingBox();
      if (box) {
        await page.screenshot({
          path: dest,
          clip: {
            x: Math.max(0, box.x - 20),
            y: Math.max(0, box.y - 20),
            width: box.width + 40,
            height: box.height + 40,
          },
        });
        console.log(`  ✓ Rendered Diagram: ${diagram.name}.png`);
      } else {
        await page.screenshot({ path: dest, fullPage: true });
        console.log(`  ✓ Rendered Diagram (full): ${diagram.name}.png`);
      }
    } else {
      await page.screenshot({ path: dest, fullPage: true });
      console.log(`  ✓ Rendered Diagram (fallback): ${diagram.name}.png`);
    }
  }

  await browser.close();
  console.log(`\n🎉 Successfully generated all 8 diagrams to: ${diagramsDir}`);
}

main();
