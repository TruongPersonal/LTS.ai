import fs from 'node:fs';
import path from 'node:path';

const read = (p) => fs.readFileSync(path.resolve(p), 'utf8');
const app = read('src/App.tsx');
const css = read('src/index.css');
const dashboard = read('src/pages/DashboardPage.tsx');
const card = read('src/components/projects/ProjectCard.tsx');
const project = read('src/pages/ProjectDetailPage.tsx');
const files = read('src/components/media/FileListTabs.tsx');
const editor = read('src/pages/EditorPage.tsx');
const landing = read('src/pages/LandingPage.tsx');

const failures = [];
const requireMatch = (value, re, label) => { if (!re.test(value)) failures.push(label); };
const requireNoMatch = (value, re, label) => { if (re.test(value)) failures.push(label); };

requireMatch(css, /--ui-canvas:\s*#ffffff/i, 'light canvas should be neutral white');
requireMatch(css, /--ui-sidebar:\s*#f7f7f8/i, 'light sidebar token missing');
requireMatch(css, /--ui-primary:\s*#111111/i, 'neutral primary action token missing');
requireMatch(css, /\.authenticated-shell\b/, 'authenticated shell CSS missing');
requireMatch(css, /\.app-sidebar\b/, 'app sidebar CSS missing');
requireMatch(css, /\.editor-workspace[\s\S]*max-width:\s*1440px/i, 'editor workspace should support 1440px');
requireMatch(app, /AppSidebar/, 'AppSidebar not wired into App');
requireNoMatch(app, /<Navbar\b/, 'authenticated top Navbar should be removed');
requireMatch(app, /editorActive=\{isEditorView\}/, 'sidebar should know editor active state');
requireNoMatch(app, /!isEditorView && <Footer/, 'authenticated workspace should not render a global footer');
requireMatch(dashboard, /project-create-tile/, 'dashboard create project tile missing');
requireMatch(card, /project-card-menu/, 'project overflow menu missing');
requireMatch(project, /project-workspace-header/, 'project workspace header missing');
requireMatch(files, /file-row-menu/, 'file overflow menu missing');
requireMatch(landing, /landing-product-proof/, 'product-first landing proof missing');
requireMatch(landing, /landing-workflow-timeline/, 'landing workflow timeline missing');
requireMatch(editor, /editor-local-toolbar/, 'editor local toolbar contract missing');

if (failures.length) {
  console.error('sidebar/workspace regression: FAIL');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('sidebar/workspace regression: PASS');
