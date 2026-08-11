import fs from 'node:fs';

const editor = fs.readFileSync('src/pages/EditorPage.tsx', 'utf8');
const css = fs.readFileSync('src/index.css', 'utf8');
const failures = [];
const requireText = (value, needle, label) => { if (!value.includes(needle)) failures.push(label); };
const forbidText = (value, needle, label) => { if (value.includes(needle)) failures.push(label); };

requireText(editor, 'CueVisibilityMenu', 'Editor must use CueVisibilityMenu');
requireText(editor, 'globalCueVisibility', 'Editor must expose global cue visibility state');
requireText(editor, 'cueVisibilityOverrides', 'Editor must expose per-cue visibility overrides');
requireText(editor, 'metadataVisible', 'Editor must resolve metadata visibility per cue');
requireText(editor, 'sourceVisible', 'Editor must resolve source visibility per cue');
requireText(editor, 'editingTextCueId', 'Translation must use edit-on-demand state');
requireText(editor, 'textDraft', 'Translation edit must use a local draft');
requireText(editor, 'data-metadata-visible', 'Cue cards must expose metadata visibility for dynamic CSS');
requireText(editor, 'data-source-visible', 'Cue cards must expose source visibility for dynamic CSS');
forbidText(editor, "{t('editor.original')} ·", 'Original/source label must be removed from cue cards');
forbidText(editor, '>{targetLanguageLabel}</p><textarea', 'Target language label + always-on textarea must be removed');
requireText(css, '.cue-visibility-menu', 'Visibility popover styles missing');
requireText(css, '.editor-translation-static', 'Read-only translation styles missing');
requireText(css, '[data-metadata-visible="false"][data-source-visible="false"]', 'Compact both-hidden cue state missing');
forbidText(css, 'height: 188px;', 'Cue cards must no longer use a fixed 188px height');
forbidText(css, 'flex: 0 0 188px;', 'Cue cards must no longer use a fixed 188px flex basis');

const menu = fs.readFileSync('src/components/editor/CueVisibilityMenu.tsx', 'utf8');
requireText(menu, 'role="menuitemcheckbox"', 'Visibility options must expose checkbox menu semantics');
requireText(menu, 'aria-checked', 'Visibility options must expose checked state');
requireText(menu, 'onClick={() => setOpen((value) => !value)}', 'Visibility menu must toggle on click');
forbidText(menu, 'onMouseEnter', 'Visibility menu must not open on hover');
forbidText(menu, 'onMouseLeave', 'Visibility menu must not close on hover leave');
forbidText(menu, 'onFocusCapture={() => setOpen(true)}', 'Visibility menu must not auto-open on focus');
requireText(editor, 'showEyeInHeader', 'Per-cue eye must anchor in visible metadata');
requireText(editor, 'showEyeInSource', 'Per-cue eye must move to source when metadata is hidden');
requireText(editor, 'showEyeInTranslation', 'Per-cue eye must move to translation when metadata and source are hidden');
requireText(editor, 'handleConfirmTextEdit', 'Translation edit must have an explicit confirm path');
requireText(editor, 'handleCancelTextEdit', 'Translation edit must have an explicit cancel path');

if (failures.length) {
  console.error('cue visibility UI regression: FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('cue visibility UI regression: PASS');
