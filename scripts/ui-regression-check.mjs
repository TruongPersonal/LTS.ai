import fs from 'node:fs';
import path from 'node:path';

const roots = ['src/pages', 'src/components', 'src/App.tsx', 'src/index.css'];
const extensions = new Set(['.ts', '.tsx', '.css']);
const files = [];

function collect(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    files.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const child = path.join(target, entry.name);
    if (entry.isDirectory()) collect(child);
    else if (extensions.has(path.extname(entry.name))) files.push(child);
  }
}

for (const root of roots) collect(root);

const forbiddenLegacyPatterns = [
  /purple-\d+/,
  /pink-\d+/,
  /backdrop-blur/,
  /creative-panel/,
  /creative-card/,
  /glass-card/,
  /neon-/,
  /ambient-blob/,
  /animate-wave-/,
];

const failures = [];
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const pattern of forbiddenLegacyPatterns) {
    if (pattern.test(text)) failures.push(`${file}: forbidden ${pattern}`);
  }
}

function requireText(file, needle) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) failures.push(`${file}: missing ${needle}`);
}
function forbidText(file, needle) {
  const text = fs.readFileSync(file, 'utf8');
  if (text.includes(needle)) failures.push(`${file}: must not contain ${needle}`);
}


requireText('src/context/ThemeContext.tsx', "|| 'light'");
requireText('src/context/ThemeContext.tsx', 'dataset.theme');
requireText('src/context/ThemeContext.tsx', "matchMedia('(prefers-color-scheme: dark)')");
requireText('src/index.css', '.editor-cue-viewport');
requireText('src/index.css', 'height: clamp(210px, 26dvh, 270px);');
requireText('src/pages/EditorPage.tsx', 'data-metadata-visible');
requireText('src/pages/EditorPage.tsx', 'data-source-visible');
forbidText('src/index.css', 'backdrop-filter');
requireText('src/App.tsx', 'isEditorView');
requireText('src/App.tsx', 'AppSidebar');
forbidText('src/App.tsx', '<Navbar');
forbidText('src/App.tsx', '!isEditorView && <Footer');
forbidText('src/App.tsx', 'FloatingToolsWidget');
if (fs.existsSync('src/components/common/FloatingToolsWidget.tsx')) failures.push('FloatingToolsWidget must be removed after login');
requireText('src/components/media/FileListTabs.tsx', 'style={{');
requireText('src/components/media/FileListTabs.tsx', 'linear-gradient(90deg');
forbidText('src/pages/LandingPage.tsx', 'linear-gradient');
if (fs.existsSync('src/App.css')) failures.push('src/App.css: unused Vite starter stylesheet must be removed');

requireText('src/components/media/FileListTabs.tsx', 'progress.message');
requireText('src/components/media/FileListTabs.tsx', 'progress.percent');
requireText('src/components/media/FileListTabs.tsx', 'progress.chunkIndex');
requireText('src/components/media/FileListTabs.tsx', 'progress.chunkCount');
requireText('src/pages/EditorPage.tsx', 'currentTime');
requireText('src/pages/EditorPage.tsx', 'handleSelectSubtitleCard');
requireText('src/pages/EditorPage.tsx', 'editor-cue-viewport');
requireText('src/pages/EditorPage.tsx', 'scrollTo');
requireText('src/components/editor/VideoPlayer.tsx', '<video');
forbidText('src/components/editor/VideoPlayer.tsx', '<iframe');

// UI bugfix contracts: viewport shell, bounded editor media, compact timing edit.
requireText('src/index.css', '#root');
requireText('src/index.css', '.app-shell');
requireText('src/index.css', 'min-height: 100dvh');
requireText('src/App.tsx', 'className="app-shell"');
forbidText('src/index.css', 'grid-template-rows: minmax(300px, 1fr) 260px;');
requireText('src/index.css', 'aspect-ratio: 16 / 9');
requireText('src/index.css', '1380px');
requireText('src/index.css', '1440px');
requireText('src/index.css', 'height: clamp(108px, 15dvh, 150px);');
requireText('src/pages/EditorPage.tsx', 'data-metadata-visible');
requireText('src/pages/EditorPage.tsx', 'data-source-visible');
requireText('src/pages/EditorPage.tsx', 'Pencil');
requireText('src/pages/EditorPage.tsx', 'editingTimingCueId');
requireText('src/pages/EditorPage.tsx', 'handleStartTimingEdit');
requireText('src/pages/EditorPage.tsx', 'handleConfirmTimingEdit');
requireText('src/pages/EditorPage.tsx', 'editingTimingCueId === item.id');

if (failures.length) {
  console.error('UI regression contracts: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('UI regression contracts: PASS');
