import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const fail = (message) => failures.push(message);
const requireExists = (file) => { if (!exists(file)) fail(`missing required file: ${file}`); };
const forbidExists = (file) => { if (exists(file)) fail(`forbidden legacy file exists: ${file}`); };
const requireText = (file, text) => { if (!exists(file) || !read(file).includes(text)) fail(`${file} missing required text: ${text}`); };
const forbidText = (file, text) => { if (exists(file) && read(file).includes(text)) fail(`${file} contains forbidden text: ${text}`); };

forbidExists('src/pages/SettingsPage.tsx');
forbidExists('src/pages/ProfilePage.tsx');
forbidExists('src/components/common/FloatingToolsWidget.tsx');
forbidExists('src/components/common/ThemeToggle.tsx');
forbidText('src/components/common/LanguageSelector.tsx', 'cycleLanguage');
requireText('src/i18n/index.ts', "lookupLocalStorage: 'lts_language'");
requireExists('src/i18n/languages.ts');
requireExists('src/i18n/formatters.ts');

const walk = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
}) : [];

for (const file of walk(path.join(root, 'src')).filter((file) => /\.(ts|tsx)$/.test(file))) {
  const content = fs.readFileSync(file, 'utf8');
  if (/window\.confirm\s*\(/.test(content)) fail(`${path.relative(root, file)} uses window.confirm`);
}

const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([key, value]) => {
  const next = prefix ? `${prefix}.${key}` : key;
  return value && typeof value === 'object' && !Array.isArray(value) ? flatten(value, next) : [next];
});
const locales = {};
for (const code of ['vi', 'en', 'ja']) {
  const file = `src/i18n/locales/${code}.json`;
  if (!exists(file)) { fail(`missing locale ${code}`); continue; }
  try { locales[code] = JSON.parse(read(file)); } catch (error) { fail(`${file} invalid JSON: ${error.message}`); }
}
if (locales.vi && locales.en && locales.ja) {
  const canonical = new Set(flatten(locales.vi));
  for (const code of ['en', 'ja']) {
    const current = new Set(flatten(locales[code]));
    for (const key of canonical) if (!current.has(key)) fail(`${code} missing key: ${key}`);
    for (const key of current) if (!canonical.has(key)) fail(`${code} extra key: ${key}`);
  }
  for (const code of ['vi', 'en', 'ja']) {
    for (const key of flatten(locales[code])) {
      if (key.startsWith('admin.') || /banned|flagged/i.test(key)) fail(`${code} contains stale key: ${key}`);
    }
  }
}

if (exists('src/App.tsx')) {
  const app = read('src/App.tsx');
  if (/SettingsPage|['"]settings['"]/.test(app)) fail('App must not expose a settings page/tab');
}
if (exists('src/pages/EditorPage.tsx')) {
  const editor = read('src/pages/EditorPage.tsx');
  if (!editor.includes('ConfirmDialog')) fail('Editor must use ConfirmDialog');
  if (!/ctrlKey|metaKey/.test(editor) || !/toLowerCase\(\)\s*===\s*['"]s['"]/.test(editor)) fail('Editor must support Ctrl/Cmd+S');
  if (!/aria-live|role=["']status/.test(editor)) fail('Editor must expose save feedback semantics');
}


// User-facing component/page copy should come from i18n. Dynamic names/brands are allowed.
const presentationFiles = [
  ...walk(path.join(root, 'src/pages')),
  ...walk(path.join(root, 'src/components')),
].filter((file) => /\.(ts|tsx)$/.test(file));
for (const file of presentationFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (/[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯẠ-ỹ]/u.test(content)) {
    fail(`${path.relative(root, file)} contains hard-coded Vietnamese user copy`);
  }
}

// Literal t('key') calls must resolve in the canonical Vietnamese dictionary.
if (locales.vi) {
  const canonicalKeys = new Set(flatten(locales.vi));
  const keyPattern = /\bt\(\s*['"]([^'"]+)['"]/g;
  for (const file of presentationFiles) {
    const content = fs.readFileSync(file, 'utf8');
    for (const match of content.matchAll(keyPattern)) {
      const key = match[1];
      if (!canonicalKeys.has(key)) fail(`${path.relative(root, file)} references missing i18n key: ${key}`);
    }
  }
}


// Final preference, navigation and accessibility contracts.
requireExists('src/components/common/ThemeSelector.tsx');
requireExists('src/components/common/PublicPreferencesControls.tsx');
forbidExists('src/components/settings/AccountSettingsSection.tsx');
forbidExists('src/components/settings/AppearanceSettingsSection.tsx');
forbidExists('src/components/settings/LanguageSettingsSection.tsx');
requireText('src/pages/LandingPage.tsx', 'PublicPreferencesControls');
requireText('src/pages/LoginPage.tsx', 'PublicPreferencesControls');
forbidText('src/components/common/UserDropdown.tsx', 'onOpenSettings');
requireText('src/components/common/UserDropdown.tsx', 'LanguageSelector');
requireText('src/components/common/UserDropdown.tsx', 'ThemeSelector');
requireText('src/components/common/ThemeSelector.tsx', "'light'");
requireText('src/components/common/ThemeSelector.tsx', "'dark'");
requireText('src/components/common/ThemeSelector.tsx', "'system'");
requireText('src/components/common/ModalWrapper.tsx', 'useId');
requireText('src/components/common/ModalWrapper.tsx', 'priorFocusRef');
requireText('src/components/common/ModalWrapper.tsx', "event.key !== 'Tab'");
requireText('src/components/common/ModalWrapper.tsx', 'aria-labelledby');
requireText('src/components/common/ConfirmDialog.tsx', 'data-autofocus');
requireText('src/components/projects/ProjectCard.tsx', 'formatUiDate');
forbidText('src/components/projects/ProjectCard.tsx', "toLocaleDateString('vi-VN')");
forbidText('src/i18n/index.ts', 'i18nextLng');

if (failures.length) {
  console.error('final UI/i18n regression: FAIL');
  failures.forEach((message) => console.error(` - ${message}`));
  process.exit(1);
}
console.log('final UI/i18n regression: PASS');
