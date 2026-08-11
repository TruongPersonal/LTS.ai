import assert from 'node:assert/strict';
import {
  DEFAULT_CUE_VISIBILITY,
  applyGlobalCueVisibilityChange,
  resolveCueVisibility,
  toggleCueVisibilityOverride,
} from '../src/utils/cueVisibility.ts';

assert.deepEqual(DEFAULT_CUE_VISIBILITY, { metadata: true, source: true });

assert.deepEqual(
  resolveCueVisibility({ metadata: true, source: true }),
  { metadata: true, source: true },
  'global visibility should apply when no cue override exists',
);

assert.deepEqual(
  resolveCueVisibility({ metadata: false, source: true }, { metadata: true }),
  { metadata: true, source: true },
  'cue metadata override should not change source visibility',
);

assert.deepEqual(
  resolveCueVisibility({ metadata: true, source: false }, { source: true }),
  { metadata: true, source: true },
  'cue source override should not change metadata visibility',
);

let overrides = {};
overrides = toggleCueVisibilityOverride(overrides, 30, 'metadata', true);
assert.deepEqual(overrides, { 30: { metadata: false } }, 'per-cue metadata toggle should store the opposite resolved value');
overrides = toggleCueVisibilityOverride(overrides, 30, 'source', true);
assert.deepEqual(overrides, { 30: { metadata: false, source: false } }, 'metadata and source overrides should remain independent');

const globalMetadataChange = applyGlobalCueVisibilityChange(
  { metadata: true, source: true },
  {
    30: { metadata: false, source: false },
    31: { metadata: false },
    32: { source: false },
  },
  'metadata',
  false,
);
assert.deepEqual(globalMetadataChange.globalVisibility, { metadata: false, source: true });
assert.deepEqual(
  globalMetadataChange.overrides,
  { 30: { source: false }, 32: { source: false } },
  'global metadata changes should clear metadata overrides only',
);

const globalSourceChange = applyGlobalCueVisibilityChange(
  { metadata: false, source: true },
  globalMetadataChange.overrides,
  'source',
  false,
);
assert.deepEqual(globalSourceChange.globalVisibility, { metadata: false, source: false });
assert.deepEqual(globalSourceChange.overrides, {}, 'global source changes should clear remaining source overrides');

for (const expected of [
  { metadata: true, source: true },
  { metadata: true, source: false },
  { metadata: false, source: true },
  { metadata: false, source: false },
]) {
  assert.deepEqual(resolveCueVisibility(expected), expected, `visibility combination ${JSON.stringify(expected)} must remain representable`);
}

console.log('cue visibility behavior tests: PASS');
