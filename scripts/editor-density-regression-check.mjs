import fs from 'node:fs';

const editor = fs.readFileSync('src/pages/EditorPage.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const failures = [];
const requireText = (value, needle, label) => { if (!value.includes(needle)) failures.push(label); };
const forbidText = (value, needle, label) => { if (value.includes(needle)) failures.push(label); };

requireText(editor, 'getEditorCueDensity', 'Editor must use the density resolver');
requireText(editor, 'const cueDensity = getEditorCueDensity(', 'Editor must derive density from global cue controls');
requireText(editor, 'data-cue-density={cueDensity}', 'Editor workspace must expose density as a data attribute');

for (const density of ['full', 'compact', 'focus']) {
  requireText(css, `.editor-workspace[data-cue-density="${density}"] .editor-video-shell`, `${density} video sizing rule missing`);
  requireText(css, `.editor-workspace[data-cue-density="${density}"] .editor-cue-viewport`, `${density} cue viewport sizing rule missing`);
}

requireText(css, 'height: clamp(210px, 26dvh, 270px);', 'Full cue viewport must be responsive');
requireText(css, 'height: clamp(150px, 20dvh, 205px);', 'Compact cue viewport must be responsive');
requireText(css, 'height: clamp(108px, 15dvh, 150px);', 'Focus cue viewport must be responsive');
requireText(css, 'overflow-y: auto;', 'Cue viewport must remain independently scrollable');
forbidText(css, '.editor-workspace .editor-video-shell { max-height: calc(100dvh - 360px); }', 'Legacy fixed video height allocation must be removed');

requireText(css, '@media (max-height: 800px) and (min-width: 769px)', 'Short-height desktop breakpoint missing');
requireText(css, '/* Adaptive density: short-height desktop */', 'Short-height density rules missing');
requireText(css, '/* Adaptive density: tablet and mobile */', 'Tablet/mobile density rules missing');
requireText(css, '/* Adaptive density: narrow phone */', 'Narrow-phone density rules missing');

if (failures.length) {
  console.error('editor density UI regression: FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('editor density UI regression: PASS');
