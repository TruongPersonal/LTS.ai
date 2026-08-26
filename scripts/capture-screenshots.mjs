import { chromium } from 'playwright';
import { createServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.resolve(rootDir, 'docs', 'screenshots');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Sample Mock Data matching thesis specifications
const mockProfile = {
  id: 'user-thien-23t1020509',
  email: 'nguyenhieuthien@hueuni.edu.vn',
  full_name: 'Nguyễn Hiếu Thiện',
  daily_processed_seconds: 1240,
  last_processed_date: '2026-08-21',
  created_at: '2026-08-01T00:00:00Z',
};

const mockProjects = [
  {
    id: 'proj-001',
    user_id: 'user-thien-23t1020509',
    title: 'Hội thảo AI & Công nghệ Phụ đề Đa ngôn ngữ 2026',
    description: 'Video hội thảo quốc tế về giải pháp ứng dụng AI trong nhận dạng tiếng nói và dịch thuật tự động',
    target_language: 'vi',
    created_at: '2026-08-15T08:30:00Z',
    updated_at: '2026-08-20T14:15:00Z',
    files_count: 3,
    files_media: [{ count: 3 }],
  },
  {
    id: 'proj-002',
    user_id: 'user-thien-23t1020509',
    title: 'Bài giảng Machine Learning & Deep Learning',
    description: 'Dịch và tạo phụ đề song ngữ cho các video bài giảng đại học MIT OpenCourseWare',
    target_language: 'vi',
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-18T16:00:00Z',
    files_count: 2,
    files_media: [{ count: 2 }],
  },
  {
    id: 'proj-003',
    user_id: 'user-thien-23t1020509',
    title: 'Phim tài liệu Khám phá Vũ trụ & Trí tuệ Nhân tạo',
    description: 'Dịch thuật phụ đề tiếng Nhật phục vụ lưu trữ học liệu số',
    target_language: 'ja',
    created_at: '2026-08-05T09:00:00Z',
    updated_at: '2026-08-12T11:20:00Z',
    files_count: 1,
    files_media: [{ count: 1 }],
  },
];

const mockFiles = [
  {
    id: 'file-001',
    project_id: 'proj-001',
    drive_file_id: 'mock-drive-id-01',
    file_name: 'Keynote_AI_Speech_Recognition_2026.mp4',
    mime_type: 'video/mp4',
    duration_seconds: 425,
    detected_source_lang: 'en',
    status: 'completed',
    input_source: 'media',
    error_message: null,
    created_at: '2026-08-15T08:35:00Z',
  },
  {
    id: 'file-002',
    project_id: 'proj-001',
    drive_file_id: 'mock-drive-id-02',
    file_name: 'Panel_Discussion_Multimodal_Whisper.mp4',
    mime_type: 'video/mp4',
    duration_seconds: 680,
    detected_source_lang: 'en',
    status: 'processing',
    input_source: 'media',
    error_message: null,
    created_at: '2026-08-15T08:40:00Z',
  },
  {
    id: 'file-003',
    project_id: 'proj-001',
    drive_file_id: 'mock-drive-id-03',
    file_name: 'Workshop_Demo_Corrupted_Audio.wav',
    mime_type: 'audio/wav',
    duration_seconds: 180,
    detected_source_lang: 'en',
    status: 'failed',
    input_source: 'media',
    error_message: 'Kích thước tệp vượt quá giới hạn 500 MB hoặc luồng âm thanh không chứa frame hợp lệ.',
    created_at: '2026-08-15T08:45:00Z',
  },
];

const mockSourceSubtitles = [
  { id: 1, start: 1.25, end: 4.80, text: 'Welcome everyone to the 2026 Artificial Intelligence Technology Summit.' },
  { id: 2, start: 5.10, end: 9.40, text: 'Today, we are exploring cutting-edge breakthroughs in speech recognition models.' },
  { id: 3, start: 9.80, end: 14.50, text: 'Groq Whisper Turbo and Gemini 3.x Flash have dramatically accelerated subtitle localization.' },
  { id: 4, start: 15.00, end: 19.80, text: 'Browser-based audio processing with WebAssembly eliminates heavy media server storage.' },
  { id: 5, start: 20.20, end: 25.50, text: 'Our cascade fallback architecture ensures 99.9% uptime during network traffic spikes.' },
  { id: 6, start: 26.00, end: 31.20, text: 'Let us dive directly into the real-time bilingual subtitle editing demonstration.' },
];

const mockTargetSubtitles = [
  { id: 1, start: 1.25, end: 4.80, text: 'Chào mừng quý vị đến với Hội nghị Thượng đỉnh Công nghệ Trí tuệ Nhân tạo 2026.' },
  { id: 2, start: 5.10, end: 9.40, text: 'Hôm nay, chúng ta sẽ cùng khám phá những bước đột phá tiên tiến trong các mô hình nhận dạng tiếng nói.' },
  { id: 3, start: 9.80, end: 14.50, text: 'Groq Whisper Turbo và Gemini 3.x Flash đã đẩy nhanh tốc độ bản địa hóa phụ đề vượt bậc.' },
  { id: 4, start: 15.00, end: 19.80, text: 'Xử lý âm thanh ngay trên trình duyệt với WebAssembly giúp loại bỏ nhu cầu lưu trữ tệp cồng kềnh trên máy chủ.' },
  { id: 5, start: 20.20, end: 25.50, text: 'Kiến trúc dự phòng kép Cascade đảm bảo tính sẵn sàng 99.9% ngay cả khi mạng quá tải.' },
  { id: 6, start: 26.00, end: 31.20, text: 'Bây giờ, hãy cùng theo dõi phần trình diễn biên tập phụ đề song ngữ theo thời gian thực.' },
];

async function setupPageInterceptors(page) {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const headers = route.request().headers();
    const isSingle = headers['accept']?.includes('vnd.pgrst.object+json');

    // Supabase Auth routes
    if (url.includes('/auth/v1/user') || url.includes('/auth/v1/session') || url.includes('/auth/v1/token')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: mockProfile.id,
            email: mockProfile.email,
            user_metadata: { full_name: mockProfile.full_name, name: mockProfile.full_name },
            aud: 'authenticated',
            role: 'authenticated',
          },
          provider_token: 'mock-google-drive-access-token',
        }),
      });
    }

    // Profiles table
    if (url.includes('/rest/v1/profiles')) {
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
          'Content-Range': '0-0/1',
        },
        body: JSON.stringify(isSingle ? mockProfile : [mockProfile]),
      });
    }

    // Projects table
    if (url.includes('/rest/v1/projects')) {
      if (url.includes('id=eq.proj-001') || url.includes('proj-001')) {
        return route.fulfill({
          status: 200,
          headers: {
            'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
            'Content-Range': '0-0/1',
          },
          body: JSON.stringify(isSingle ? mockProjects[0] : [mockProjects[0]]),
        });
      }
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': `0-${mockProjects.length - 1}/${mockProjects.length}`,
        },
        body: JSON.stringify(mockProjects),
      });
    }

    // Files Media table
    if (url.includes('/rest/v1/files_media')) {
      if (url.includes('id=eq.file-001')) {
        return route.fulfill({
          status: 200,
          headers: {
            'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
            'Content-Range': '0-0/1',
          },
          body: JSON.stringify(isSingle ? mockFiles[0] : [mockFiles[0]]),
        });
      }
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': `0-${mockFiles.length - 1}/${mockFiles.length}`,
        },
        body: JSON.stringify(mockFiles),
      });
    }

    // Subtitles table
    if (url.includes('/rest/v1/subtitles')) {
      if (url.includes('language=eq.en') || url.includes('language=eq.detected')) {
        const sub = {
          id: 'sub-source-001',
          file_id: 'file-001',
          language: 'en',
          content: mockSourceSubtitles,
          is_edited: false,
          updated_at: '2026-08-15T08:36:00Z',
        };
        return route.fulfill({
          status: 200,
          headers: {
            'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
            'Content-Range': '0-0/1',
          },
          body: JSON.stringify(isSingle ? sub : [sub]),
        });
      }
      const subTarget = {
        id: 'sub-target-001',
        file_id: 'file-001',
        language: 'vi',
        content: mockTargetSubtitles,
        is_edited: true,
        updated_at: '2026-08-15T08:37:00Z',
      };
      return route.fulfill({
        status: 200,
        headers: {
          'Content-Type': isSingle ? 'application/vnd.pgrst.object+json' : 'application/json',
          'Content-Range': '0-0/1',
        },
        body: JSON.stringify(isSingle ? subTarget : [subTarget]),
      });
    }

    // Google Drive video stream mock
    if (url.includes('googleapis.com/drive/v3/files/')) {
      const sampleVideo = path.resolve(rootDir, 'public', 'landing-video.mp4');
      if (fs.existsSync(sampleVideo)) {
        return route.fulfill({
          status: 200,
          contentType: 'video/mp4',
          body: fs.readFileSync(sampleVideo),
        });
      }
      return route.fulfill({ status: 200, contentType: 'video/mp4', body: Buffer.alloc(0) });
    }

    return route.continue();
  });
}

async function injectAuthAndTheme(page, { theme = 'light', lang = 'vi' } = {}) {
  await page.addInitScript(({ theme, lang, mockProfile }) => {
    window.localStorage.setItem('lts_theme', theme);
    window.localStorage.setItem('lts_language', lang);
    window.sessionStorage.setItem('google_access_token', 'mock-google-drive-access-token');
    window.sessionStorage.setItem('lts_google_token_expires_at', String(Date.now() + 60 * 60 * 1000));

    const sessionData = {
      access_token: 'mock-jwt-token',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'mock-refresh-token',
      user: {
        id: mockProfile.id,
        email: mockProfile.email,
        user_metadata: { full_name: mockProfile.full_name, name: mockProfile.full_name },
        aud: 'authenticated',
        role: 'authenticated',
      },
      provider_token: 'mock-google-drive-access-token',
    };
    
    window.localStorage.setItem('sb-demo-placeholder-auth-token', JSON.stringify(sessionData));
    window.localStorage.setItem('supabase.auth.token', JSON.stringify({ currentSession: sessionData }));
  }, { theme, lang, mockProfile });
}

async function main() {
  console.log('🚀 Starting Vite server...');
  const server = await createServer({
    root: rootDir,
    server: { port: 5199, strictPort: true },
  });
  await server.listen();
  const baseUrl = 'http://localhost:5199';
  console.log(`✅ Vite server running at ${baseUrl}`);

  console.log('🌐 Launching Chromium browser with Playwright (Light Theme by default)...');
  const browser = await chromium.launch({
    headless: true,
  });

  console.log('📸 Capturing FULL-PAGE screenshots in LIGHT THEME...');

  // Helper for capturing full scrollable page
  const snapFullPage = async (page, filename, waitMs = 500) => {
    if (waitMs) await page.waitForTimeout(waitMs);
    const dest = path.join(outputDir, filename);
    await page.screenshot({ path: dest, fullPage: true });
    console.log(`  ✓ Saved Full-Page (Light): ${filename}`);
  };

  try {
    // -------------------------------------------------------------
    // 4.1 Landing Page (Light Mode Full Page)
    // -------------------------------------------------------------
    const publicContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'vi-VN',
      colorScheme: 'light',
    });
    const publicPage = await publicContext.newPage();
    await publicPage.addInitScript(() => {
      window.localStorage.setItem('lts_theme', 'light');
    });
    await setupPageInterceptors(publicPage);

    await publicPage.goto(`${baseUrl}/`);
    await publicPage.waitForSelector('.landing-hero, h1', { timeout: 15000 });
    
    // Scroll down to trigger any lazy-loaded elements on the long landing page
    await publicPage.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 300;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            window.scrollTo(0, 0);
            resolve();
          }
        }, 100);
      });
    });

    await snapFullPage(publicPage, 'Hinh_4_1_Landing_Page.png', 1000);

    // -------------------------------------------------------------
    // 4.2 Login Page (Light Mode Full Page)
    // -------------------------------------------------------------
    await publicPage.goto(`${baseUrl}/login`);
    await publicPage.waitForSelector('.login-card, button', { timeout: 15000 });
    await snapFullPage(publicPage, 'Hinh_4_2_Login_Page.png', 600);
    await publicContext.close();

    // -------------------------------------------------------------
    // Authenticated Context Setup (Light Mode)
    // -------------------------------------------------------------
    const authContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      locale: 'vi-VN',
      colorScheme: 'light',
    });
    const page = await authContext.newPage();
    await setupPageInterceptors(page);
    await injectAuthAndTheme(page, { theme: 'light', lang: 'vi' });

    // -------------------------------------------------------------
    // 4.3 Dashboard - Project List (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects`);
    await page.waitForSelector('.project-card, .workspace-page', { timeout: 15000 });
    await snapFullPage(page, 'Hinh_4_3_Dashboard_Projects.png', 1000);

    // -------------------------------------------------------------
    // 4.4 Create Project Modal (Light Mode Full Page)
    // -------------------------------------------------------------
    const createBtn = page.locator('button.ui-button-primary:has-text("Tạo"), .workspace-page-header button.ui-button-primary').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(400);
      const titleInput = page.locator('input#project-title, input[placeholder*="tên dự án"], form input').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Xây dựng phụ đề Phim Khoa học Vũ trụ');
      }
      await snapFullPage(page, 'Hinh_4_4_Modal_Create_Project.png', 500);

      const closeBtn = page.locator('button:has-text("Hủy"), button[aria-label*="Đóng"]').first();
      if (await closeBtn.isVisible()) await closeBtn.click();
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // 4.5 Edit Project Modal (Light Mode Full Page)
    // -------------------------------------------------------------
    const projectMenuBtn = page.locator('.project-card .ui-icon-button, .project-card button[aria-label*="khác"]').first();
    if (await projectMenuBtn.isVisible()) {
      await projectMenuBtn.click();
      await page.waitForTimeout(300);
      const editOption = page.locator('.project-dropdown-item:has-text("Sửa"), button:has-text("Sửa")').first();
      if (await editOption.isVisible()) {
        await editOption.click();
        await page.waitForTimeout(400);
        await snapFullPage(page, 'Hinh_4_5_Modal_Edit_Project.png', 500);
        const cancelBtn = page.locator('button:has-text("Hủy")').first();
        if (await cancelBtn.isVisible()) await cancelBtn.click();
        await page.waitForTimeout(300);
      }
    }

    // -------------------------------------------------------------
    // 4.6 Project Detail - File List (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects/proj-001`);
    await page.waitForSelector('.project-workspace-header, .file-workspace-row, .workspace-page', { timeout: 15000 });
    await snapFullPage(page, 'Hinh_4_6_Project_Detail_Files.png', 1000);

    // -------------------------------------------------------------
    // 4.7 Google Drive Picker Modal (Light Mode Full Page)
    // -------------------------------------------------------------
    const addFileBtn = page.locator('button:has-text("Thêm tệp"), button:has-text("Drive"), button:has-text("Chọn tệp")').first();
    if (await addFileBtn.isVisible()) {
      await addFileBtn.click();
      await page.waitForTimeout(500);
      await snapFullPage(page, 'Hinh_4_7_Google_Drive_Picker_Modal.png', 500);
    }

    // -------------------------------------------------------------
    // 4.8 Drive Picker with Subtitle Attachment (Light Mode Full Page)
    // -------------------------------------------------------------
    const attachSubtitleCheckbox = page.locator('input[type="checkbox"]').first();
    if (await attachSubtitleCheckbox.count() > 0) {
      await attachSubtitleCheckbox.check({ force: true });
      await page.waitForTimeout(400);
      await snapFullPage(page, 'Hinh_4_8_Drive_Picker_Subtitle_Attachment.png', 500);
      const closePicker = page.locator('button:has-text("Hủy"), button[aria-label*="Đóng"]').first();
      if (await closePicker.isVisible()) await closePicker.click();
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // 4.9 Floating Processing Widget (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects/proj-001`);
    await page.waitForSelector('.project-workspace-header, .file-workspace-row', { timeout: 15000 });
    const unfinishedTab = page.locator('.attached-tab:first-child, button[aria-label*="chưa"]').first();
    if (await unfinishedTab.isVisible()) {
      await unfinishedTab.click();
      await page.waitForTimeout(400);
    }
    await snapFullPage(page, 'Hinh_4_9_Floating_Processing_Widget.png', 400);

    // -------------------------------------------------------------
    // 4.10 File Status Processing (Light Mode Full Page on Unfinished Tab)
    // -------------------------------------------------------------
    if (await unfinishedTab.isVisible()) {
      await unfinishedTab.click();
      await page.waitForTimeout(400);
    }
    await snapFullPage(page, 'Hinh_4_10_File_Status_Processing.png', 400);

    // -------------------------------------------------------------
    // 4.11 File Status Completed (Light Mode Full Page on Completed Tab)
    // -------------------------------------------------------------
    const completedTab = page.locator('.attached-tab:nth-child(2), button[aria-label*="hoàn thành"]').first();
    if (await completedTab.isVisible()) {
      await completedTab.click();
      await page.waitForSelector('.file-workspace-row', { timeout: 5000 });
      await page.waitForTimeout(400);
    }
    await snapFullPage(page, 'Hinh_4_11_File_Status_Completed.png', 400);

    // -------------------------------------------------------------
    // 4.12 File Status Failed with Error Alert (Light Mode Full Page)
    // -------------------------------------------------------------
    const failedRow = page.locator('.file-workspace-row:has-text("Workshop_Demo"), .file-workspace-row:has-text("Thất bại")').first();
    if (await failedRow.isVisible()) {
      await failedRow.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    await snapFullPage(page, 'Hinh_4_12_File_Status_Failed.png', 400);

    // -------------------------------------------------------------
    // 4.13 Subtitle Editor Overview (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects/proj-001/editor/file-001`);
    await page.waitForSelector('.editor-local-toolbar, .editor-cue-card, .editor-cue-viewport', { timeout: 15000 });
    await snapFullPage(page, 'Hinh_4_13_Subtitle_Editor_Overview.png', 1200);

    // -------------------------------------------------------------
    // 4.14 Editor Bilingual Mode (Light Mode Full Page)
    // -------------------------------------------------------------
    const bilingualBtn = page.locator('button:has-text("Song ngữ"), button:has-text("Bilingual")').first();
    if (await bilingualBtn.isVisible()) {
      await bilingualBtn.click();
    }
    await snapFullPage(page, 'Hinh_4_14_Editor_Bilingual_Mode.png', 600);

    // -------------------------------------------------------------
    // 4.15 Editor Edit Timing (Light Mode Full Page)
    // -------------------------------------------------------------
    const timingBadge = page.locator('.editor-cue-card button:has-text(":")').first();
    if (await timingBadge.isVisible()) {
      await timingBadge.click();
    }
    await snapFullPage(page, 'Hinh_4_15_Editor_Edit_Timing.png', 500);

    // -------------------------------------------------------------
    // 4.16 Editor Add Cue (Light Mode Full Page)
    // -------------------------------------------------------------
    const addCueBtn = page.locator('button:has-text("Thêm câu"), button:has-text("Add Cue")').first();
    if (await addCueBtn.isVisible()) {
      await addCueBtn.click();
    }
    await snapFullPage(page, 'Hinh_4_16_Editor_Add_Cue.png', 500);

    // -------------------------------------------------------------
    // 4.17 Subtitle Export Modal (Light Mode Full Page)
    // -------------------------------------------------------------
    const exportBtn = page.locator('button:has-text("Xuất"), button:has-text("Export")').first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(400);
      await snapFullPage(page, 'Hinh_4_17_Subtitle_Export_Modal.png', 500);
      const closeExport = page.locator('button:has-text("Hủy"), button[aria-label*="Đóng"]').first();
      if (await closeExport.isVisible()) await closeExport.click();
      await page.waitForTimeout(300);
    }

    // -------------------------------------------------------------
    // 4.18 Dark Mode View (Specific showcase for Dark Mode)
    // -------------------------------------------------------------
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark';
      document.documentElement.style.colorScheme = 'dark';
      localStorage.setItem('lts_theme', 'dark');
    });
    await page.goto(`${baseUrl}/projects`);
    await page.waitForSelector('.project-card', { timeout: 15000 });
    await snapFullPage(page, 'Hinh_4_18_Dark_Mode.png', 600);

    // Switch back to light mode for remaining captures
    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light';
      document.documentElement.style.colorScheme = 'light';
      localStorage.setItem('lts_theme', 'light');
    });

    // -------------------------------------------------------------
    // 4.19 Light Mode View (Showcase for Light Mode)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects`);
    await page.waitForSelector('.project-card', { timeout: 15000 });
    await snapFullPage(page, 'Hinh_4_19_Light_Mode.png', 600);

    // -------------------------------------------------------------
    // 4.20 UI Language Selector (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects`);
    await page.waitForSelector('.project-card', { timeout: 15000 });
    const langBtn = page.locator('.app-sidebar button:has-text("VI"), .app-sidebar button:has-text("Tiếng Việt"), .language-selector-btn').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(300);
    }
    await snapFullPage(page, 'Hinh_4_20_UI_Language_Selector.png', 400);
    await page.keyboard.press('Escape');

    // -------------------------------------------------------------
    // 4.21 App Sidebar (Light Mode Full Page)
    // -------------------------------------------------------------
    await snapFullPage(page, 'Hinh_4_21_App_Sidebar.png', 300);

    // -------------------------------------------------------------
    // 4.22 User Dropdown Menu (Light Mode Full Page)
    // -------------------------------------------------------------
    const userDropdownTrigger = page.locator('.app-sidebar-bottom button, button:has-text("Nguyễn Hiếu Thiện"), button[aria-label*="tài khoản"]').first();
    if (await userDropdownTrigger.isVisible()) {
      await userDropdownTrigger.click();
      await page.waitForTimeout(300);
    }
    await snapFullPage(page, 'Hinh_4_22_User_Dropdown_Menu.png', 400);
    await page.keyboard.press('Escape');

    // -------------------------------------------------------------
    // 4.23 Rename File Modal (Light Mode Full Page)
    // -------------------------------------------------------------
    await page.goto(`${baseUrl}/projects/proj-001`);
    await page.waitForSelector('.file-workspace-row', { timeout: 15000 });
    const fileMenuBtn = page.locator('.file-workspace-row button.ui-icon-button, .file-workspace-row button[aria-label*="tùy chọn"]').first();
    if (await fileMenuBtn.isVisible()) {
      await fileMenuBtn.click();
      await page.waitForTimeout(400);
      const renameOption = page.locator('button[role="menuitem"]:has-text("Sửa tệp"), .overflow-menu button:first-child').first();
      if (await renameOption.isVisible()) {
        await renameOption.click();
        await page.waitForSelector('.ui-modal, form', { timeout: 5000 });
        await snapFullPage(page, 'Hinh_4_23_Modal_Rename_File.png', 500);
        const closeRename = page.locator('button:has-text("Hủy")').first();
        if (await closeRename.isVisible()) await closeRename.click();
        await page.waitForTimeout(300);
      }
    }

    // -------------------------------------------------------------
    // 4.24 Confirm Delete Dialog (Light Mode Full Page)
    // -------------------------------------------------------------
    const fileMenuBtnForDelete = page.locator('.file-workspace-row button.ui-icon-button, .file-workspace-row button[aria-label*="tùy chọn"]').first();
    if (await fileMenuBtnForDelete.isVisible()) {
      await fileMenuBtnForDelete.click();
      await page.waitForTimeout(400);
      const deleteOption = page.locator('button[role="menuitem"]:has-text("Xóa tệp"), .overflow-menu button.ui-danger-text').first();
      if (await deleteOption.isVisible()) {
        await deleteOption.click();
        await page.waitForSelector('[role="dialog"], .ui-modal, .modal-card', { timeout: 5000 });
        await snapFullPage(page, 'Hinh_4_24_Confirm_Delete_Dialog.png', 500);
      }
    }

    console.log(`\n🎉 Successfully captured all 24 LIGHT THEME screenshots to: ${outputDir}`);
  } catch (err) {
    console.error('❌ Error capturing screenshots:', err);
  } finally {
    await browser.close();
    await server.close();
    console.log('🛑 Cleaned up browser and Vite server.');
  }
}

main();
