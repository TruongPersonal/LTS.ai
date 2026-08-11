import assert from 'node:assert/strict';

let moduleUnderTest = null;
try {
  moduleUnderTest = await import('../src/utils/mediaProcessing.ts');
} catch {
  // The first TDD run intentionally reaches this path before the helper exists.
}

assert.ok(moduleUnderTest, 'mediaProcessing helper module must exist');

const { mergeTranscriptionChunks, getTranscriptionProgressPercent } = moduleUnderTest;

const merged = mergeTranscriptionChunks([
  {
    sourceLanguage: 'ja',
    subtitles: [
      { id: 1, start: 0.25, end: 1.5, text: 'one' },
      { id: 2, start: 2, end: 3, text: 'two' },
    ],
  },
  {
    sourceLanguage: 'ja',
    subtitles: [
      { id: 1, start: 420.1, end: 421.2, text: 'three' },
    ],
  },
]);

assert.equal(merged.sourceLanguage, 'ja', 'first detected chunk language should be retained');
assert.deepEqual(merged.subtitles.map((cue) => cue.id), [1, 2, 3], 'merged cues must receive stable sequential IDs');
assert.deepEqual(merged.subtitles.map((cue) => cue.text), ['one', 'two', 'three'], 'merged cue text order must be preserved');
assert.deepEqual(merged.subtitles.map((cue) => cue.start), [0.25, 2, 420.1], 'global timestamps returned by Edge must remain unchanged');

assert.throws(
  () => mergeTranscriptionChunks([{ sourceLanguage: 'en', subtitles: [] }]),
  /no subtitle/i,
  'empty transcription must be rejected'
);

console.log('media processing behavior tests: PASS');

assert.equal(getTranscriptionProgressPercent(0, 4), 56, 'first of four chunks should enter the transcription range');
assert.equal(getTranscriptionProgressPercent(3, 4), 82, 'last chunk should reach the end of the transcription range');
assert.equal(getTranscriptionProgressPercent(0, 1), 82, 'single chunk should complete the transcription range');
