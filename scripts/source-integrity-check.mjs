import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const fail = (message) => { throw new Error(message); };
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});

const srcFiles = walk(path.join(root, 'src'));
const tsFiles = srcFiles.filter((file) => /\.(?:ts|tsx)$/.test(file));
const sourceText = tsFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

// Relative import resolution.
const importPattern = /(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g;
let importCount = 0;
for (const file of tsFiles) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(importPattern)) {
    importCount += 1;
    const base = path.resolve(path.dirname(file), match[1]);
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')];
    if (!candidates.some((candidate) => fs.existsSync(candidate))) {
      fail(`Unresolved relative import in ${path.relative(root, file)}: ${match[1]}`);
    }
  }
}

// Locale JSON and recursive key parity.
const localeDir = path.join(root, 'src/i18n/locales');
const flatten = (value, prefix = '', out = []) => {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, out);
    else out.push(next);
  }
  return out;
};
const localeKeys = {};
for (const locale of ['vi', 'en', 'ja']) {
  const parsed = JSON.parse(fs.readFileSync(path.join(localeDir, `${locale}.json`), 'utf8'));
  localeKeys[locale] = flatten(parsed).sort();
}
const canonical = JSON.stringify(localeKeys.vi);
for (const locale of ['en', 'ja']) {
  if (JSON.stringify(localeKeys[locale]) !== canonical) fail(`Locale key parity failed for ${locale}`);
}

// Presentation contract scans.
const forbidden = [
  ['window.confirm', /window\.confirm\s*\(/],
  ['iframe', /<iframe\b/i],
  ['legacy purple', /\bpurple-/],
  ['legacy pink', /\bpink-/],
  ['glass', /\bglass(?:-|\b)/i],
  ['neon', /\bneon(?:-|\b)/i],
  ['backdrop blur', /backdrop-blur/],
  ['cyclic language selector', /cycleLanguage/],
  ['cyclic theme selector', /cycleTheme/],
];
for (const [label, pattern] of forbidden) {
  if (pattern.test(sourceText)) fail(`Forbidden presentation pattern found: ${label}`);
}

// CSS lightweight structural check.
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
let depth = 0;
for (const char of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
  if (char === '{') depth += 1;
  if (char === '}') depth -= 1;
  if (depth < 0) fail('CSS has an unmatched closing brace');
}
if (depth !== 0) fail('CSS has unmatched braces');

console.log(`source integrity: PASS (${tsFiles.length} TS/TSX files, ${importCount} relative imports, ${localeKeys.vi.length} i18n keys/locale)`);
