import assert from 'node:assert/strict';
import { getEditorCueDensity } from '../src/utils/editorDensity.ts';

const cases = [
  [[true, true, true], 'full'],
  [[false, false, false], 'focus'],
  [[false, true, true], 'compact'],
  [[true, false, true], 'compact'],
  [[true, true, false], 'compact'],
  [[false, false, true], 'compact'],
];

for (const [[metadataVisible, sourceVisible, actionsVisible], expected] of cases) {
  assert.equal(
    getEditorCueDensity(metadataVisible, sourceVisible, actionsVisible),
    expected,
    `${metadataVisible}/${sourceVisible}/${actionsVisible} should resolve to ${expected}`,
  );
}

console.log('editor density behavior tests: PASS');
