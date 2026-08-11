import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const [,, command, manifestPathArg] = process.argv;
const root = process.cwd();
const manifestPath = path.resolve(root, manifestPathArg || '.frozen-core-ui-final.json');

const explicitPaths = [
  'src/context/AuthContext.tsx',
  'src/lib/supabase.ts',
  'src/services/fileService.ts',
  'src/services/mediaAudioPreprocessor.ts',
  'src/services/projectService.ts',
  'src/services/subtitleService.ts',
  'src/types/database.ts',
  'src/types/processing.ts',
  'src/utils/exporter.ts',
  'src/utils/mediaProcessing.ts',
  'src/utils/subtitleEditor.ts',
  'src/utils/subtitleParsers.ts',
  'src/utils/time.ts',
];

const walk = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [path.relative(root, full).replaceAll('\\', '/')];
  });
};

const frozenFiles = [...new Set([...walk(path.join(root, 'supabase')), ...explicitPaths])]
  .filter((file) => fs.existsSync(path.join(root, file)))
  .sort();

const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const current = Object.fromEntries(frozenFiles.map((file) => [file, hashFile(file)]));

if (command === 'write') {
  fs.writeFileSync(manifestPath, `${JSON.stringify({ version: 1, files: current }, null, 2)}\n`);
  console.log(`frozen core manifest written: ${frozenFiles.length} files`);
} else if (command === 'verify') {
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const expected = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).files || {};
  const failures = [];
  for (const [file, hash] of Object.entries(expected)) {
    if (!fs.existsSync(path.join(root, file))) failures.push(`${file}: missing`);
    else if (hashFile(file) !== hash) failures.push(`${file}: changed`);
  }
  for (const file of Object.keys(current)) {
    if (!(file in expected)) failures.push(`${file}: newly included frozen file`);
  }
  if (failures.length) {
    console.error('frozen core verification: FAIL');
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log(`frozen core verification: PASS (${Object.keys(expected).length} files)`);
} else {
  console.error('Usage: node scripts/frozen-core-manifest.mjs write|verify <manifest-path>');
  process.exit(2);
}
