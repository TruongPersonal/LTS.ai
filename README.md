# 🎬 LTS.ai

LTS.ai là nền tảng web hiện đại tích hợp trí tuệ nhân tạo (AI) giúp tự động nhận dạng giọng nói, tạo và dịch phụ đề song ngữ từ các tệp media trên Google Drive một cách an toàn, minh bạch và hiệu quả.

## ✨ Tính năng nổi bật

- **Tự động tạo phụ đề (Speech-to-Text):** Trích xuất âm thanh và chuyển đổi giọng nói thành phụ đề văn bản chuẩn xác với công nghệ Groq Whisper AI.
- **Dịch thuật song ngữ AI:** Tự động dịch phụ đề sang 7 ngôn ngữ phổ biến (Tiếng Việt, Tiếng Anh, Tiếng Nhật, Tiếng Hàn, Tiếng Trung, Tiếng Pháp, Tiếng Ý) nhờ Groq Llama 3 AI.
- **Tích hợp Google Drive:** Nạp tệp video/audio trực tiếp từ Google Drive cá nhân thông qua Google OAuth 2.0 và Google Drive API.
- **Trình biên tập phụ đề (Subtitle Editor):** Chỉnh sửa văn bản, mốc thời gian (timing), xem trước video trực tiếp, hỗ trợ linh hoạt các chế độ hiển thị (bản gốc/bản dịch/song ngữ).
- **Xuất phụ đề đa dạng:** Hỗ trợ xuất các định dạng chuẩn quốc tế (SRT, VTT, TXT) theo dạng file đơn lẻ hoặc đóng gói ZIP toàn bộ dự án.
- **Xử lý âm thanh tại trình duyệt:** Sử dụng `FFmpeg.wasm` để tách và nén âm thanh trực tiếp trên trình duyệt, tối ưu dung lượng và băng thông truyền tải.
- **Bảo mật & Phân quyền:** Đăng nhập an toàn qua tài khoản Google, bảo mật tuyệt đối với Supabase Auth (JWT) và serverless Edge Functions.
- **Giao diện đáp ứng & Đa ngôn ngữ:** Hỗ trợ giao diện Sáng/Tối (Light/Dark mode) và 3 ngôn ngữ giao diện (Tiếng Việt, Tiếng Anh, Tiếng Nhật).

## 🛠️ Công nghệ sử dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons |
| **Xử lý Media & Audio** | FFmpeg.wasm (`@ffmpeg/ffmpeg`) |
| **Backend & Serverless** | Supabase Edge Functions (Deno / TypeScript) |
| **Trí tuệ nhân tạo (AI)** | Groq Whisper (Speech-to-Text), Groq Llama (Translation) |
| **Cơ sở dữ liệu** | PostgreSQL (Supabase `lts_ai` schema) |
| **Bảo mật & Xác thực** | Google OAuth 2.0, Supabase Auth (JWT) |
| **Lưu trữ & Xuất tệp** | Google Drive API, JSZip, FileSaver |

## 🚀 Hướng dẫn cài đặt & Chạy ứng dụng

1. **Sao chép cấu hình môi trường:**
   ```bash
   cp .env.example .env
   ```
   Cấu hình `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` và `VITE_GOOGLE_CLIENT_ID`.

2. **Cài đặt thư viện & Chạy phát triển:**
   ```bash
   npm install
   npm run dev
   ```

3. **Kiểm tra & Build production:**
   ```bash
   npm test
   npm run build
   ```

## 📄 Ghi chú

- Dự án này được phát triển phục vụ cho báo cáo đồ án môn học **Thực tập viết niên luận**.
- **Sinh viên chủ nhiệm:** Ngô Quang Trường (23t1020573) - TS. Nguyễn Văn Trung lớp học phần 2025-2026.2.TIN3142.007
