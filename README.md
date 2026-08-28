# 🎬 LTS.ai

LTS.ai là nền tảng web hiện đại tích hợp trí tuệ nhân tạo (AI) giúp tự động nhận dạng giọng nói, tạo, biên tập và dịch phụ đề song ngữ từ các tệp media trên Google Drive một cách an toàn, minh bạch và tối ưu hiệu năng.

---

## ✨ Tính năng nổi bật

- **Tự động nhận dạng giọng nói (Speech-to-Text):** Trích xuất âm thanh và chuyển đổi giọng nói thành phụ đề chuẩn xác với công nghệ **Groq Whisper Turbo AI** *(tự động chuyển đổi mô hình dự phòng)*.
- **Dịch thuật song ngữ AI:** Tự động dịch phụ đề sang 7 ngôn ngữ phổ biến (Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Trung, Tiếng Pháp, Tiếng Ý) nhờ **Google Gemini Flash AI** với cơ chế chia lô (batching) tốc độ cao.
- **Hệ thống AI Cascade Dự phòng Kép:** Tự động chuyển đổi thông minh giữa các mô hình AI khi gặp sự cố nghẽn mạng hoặc vượt hạn mức tạm thời.
- **Tích hợp Google Drive:** Nạp tệp video/audio trực tiếp từ Google Drive cá nhân thông qua Google OAuth 2.0 và Google Drive API.
- **Trình biên tập phụ đề chuyên nghiệp (Subtitle Editor):** Chỉnh sửa nội dung văn bản, mốc thời gian (timing), thêm/xóa câu phụ đề, phát video đồng bộ với phụ đề thời gian thực, hỗ trợ các chế độ hiển thị linh hoạt (nguồn, đích, song ngữ).
- **Xuất phụ đề đa định dạng:** Hỗ trợ xuất các định dạng chuẩn quốc tế (SRT, VTT, TXT) theo file đơn lẻ hoặc nén ZIP toàn bộ dự án.
- **Xuất Video Phụ Đề (Hardsub Export):** Nhúng phụ đề trực tiếp vào video MP4 bằng FFmpeg.wasm ngay trên trình duyệt mà không cần cài đặt phần mềm bên ngoài.
- **Quản lý Gói Cước & Thanh toán Stripe:** Tích hợp Stripe Checkout hỗ trợ các gói dịch vụ (Free, Pro, Max) với hệ thống hạn mức thời lượng và dung lượng tệp linh hoạt.
- **Bảng điều khiển Quản trị (Admin Portal):** Quản lý người dùng, phân quyền (User/Admin), quản lý dự án, theo dõi doanh thu Stripe trực tiếp, cấu hình hạn mức hệ thống (Quotas) và xem Nhật ký kiểm toán bảo mật (Audit Log).
- **Giao diện hiện đại & Đa ngôn ngữ:** Hỗ trợ Dark/Light mode, hiệu ứng vũ trụ Cosmic Canvas và 3 ngôn ngữ giao diện (Tiếng Việt, Tiếng Anh, Tiếng Nhật).

---

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Xử lý Media & Video Export** | FFmpeg.wasm (`@ffmpeg/ffmpeg`, `@ffmpeg/util`) |
| **Backend & Serverless** | Supabase Edge Functions (Deno / TypeScript) |
| **Trí tuệ nhân tạo (AI)** | **Groq Whisper Turbo** (Speech-to-Text)<br>**Google Gemini 2.0 Flash / 1.5 Flash** (Translation) |
| **Cơ sở dữ liệu** | PostgreSQL (Supabase schema `lts_ai`) với RLS chặt chẽ |
| **Bảo mật & Xác thực** | Google OAuth 2.0, Supabase Auth (JWT) |
| **Cổng thanh toán** | Stripe API & Stripe Checkout Sessions |
| **Lưu trữ & Xuất tệp** | Google Drive API, JSZip, FileSaver |

---

## 📁 Cấu trúc thư mục

```text
├── src/
│   ├── components/       # Giao diện (Admin, Editor, Common, Landing, Media, Subscription)
│   ├── context/          # React Context (AuthContext, ProcessingContext)
│   ├── hooks/            # Custom Hooks (useEditorSubtitles, useVideoExport, ...)
│   ├── i18n/             # Bản dịch đa ngôn ngữ (vi, en, ja)
│   ├── lib/              # Cấu hình Supabase & Google Client
│   ├── pages/            # Các trang chính (Dashboard, Editor, Admin, Landing, ...)
│   ├── services/         # Tầng kết nối API (fileService, mediaProcessingPipeline, ...)
│   ├── types/            # TypeScript Interface & Type Definitions
│   └── utils/            # Tiện ích chuyển đổi thời gian, parser phụ đề, exporter
├── supabase/
│   ├── functions/        # Supabase Edge Functions (admin, process-media, checkout, ...)
│   ├── schema.sql        # Toàn bộ Database Schema, RLS Policies & RPCs
│   └── .env.example      # Cấu hình mẫu cho Edge Functions
└── package.json
```

---

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

### 1. Cấu hình môi trường Frontend:
Tạo file `.env` tại thư mục gốc:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your_google_picker_api_key
```

### 2. Cấu hình môi trường Supabase Edge Functions:
Cấu hình secrets trong Supabase Dashboard hoặc file `supabase/.env`:
```env
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PRO_PRICE_ID=price_your_pro_price_id
STRIPE_MAX_PRICE_ID=price_your_max_price_id
APP_URL=http://localhost:5173
```

### 3. Thiết lập Database:
Chạy toàn bộ nội dung file [`supabase/schema.sql`](supabase/schema.sql) trong **Supabase SQL Editor**.

### 4. Cài đặt thư viện & Khởi chạy:
```bash
npm install
npm run dev
```

### 5. Kiểm tra & Build Production:
```bash
npm run test
npm run build
```

---

## 📄 Ghi chú

- Dự án này được phát triển phục vụ cho báo cáo đồ án môn học **Thực tập viết niên luận**.
- **Sinh viên thực hiện:** Ngô Quang Trường (23T1020573)
- **Giảng viên hướng dẫn:** TS. Nguyễn Văn Trung
- **Lớp học phần:** 2025-2026.2.TIN3142.007
