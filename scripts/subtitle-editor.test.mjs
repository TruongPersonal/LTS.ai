import assert from 'node:assert/strict';
import {
  findActiveCueId,
  getSourceTextById,
  insertCueAfter,
  removeCue,
  updateCueTiming,
} from '../src/utils/subtitleEditor.ts';

const cues = [
  { id: 1, start: 0, end: 2, text: 'One' },
  { id: 2, start: 2, end: 4.5, text: 'Two' },
  { id: 3, start: 5, end: 8, text: 'Three' },
];

assert.equal(findActiveCueId(cues, 0), 1, 'first cue should be active at its start');
assert.equal(findActiveCueId(cues, 4.49), 2, 'cue should remain active before its end');
assert.equal(findActiveCueId(cues, 4.5), null, 'cue end must be exclusive');
assert.equal(findActiveCueId(cues, 5), 3, 'later cue should activate at its start');

const startEdited = updateCueTiming(cues, 2, 'start', 2.5);
assert.equal(startEdited[1].start, 2.5, 'valid start edit should be applied');
assert.equal(updateCueTiming(cues, 2, 'start', 5)[1].start, 2, 'start cannot be moved to or beyond end');
assert.equal(updateCueTiming(cues, 2, 'end', 1)[1].end, 4.5, 'end cannot be moved to or before start');
assert.equal(updateCueTiming(cues, 2, 'start', -1)[1].start, 2, 'negative timing must be rejected');

const inserted = insertCueAfter(cues, 2);
assert.equal(inserted.length, 4, 'insert should add one cue');
assert.equal(inserted[2].id, 4, 'inserted cue should receive the next numeric id');
assert.equal(inserted[2].start, 4.5, 'inserted cue should start at the previous cue end');
assert(inserted[2].end > inserted[2].start, 'inserted cue must have a positive duration');

const removed = removeCue(cues, 2);
assert.deepEqual(removed.map((cue) => cue.id), [1, 3], 'delete should remove only the selected cue');

assert.equal(getSourceTextById(cues, 2), 'Two', 'source text should align by cue id');
assert.equal(getSourceTextById(cues, 99), '', 'missing source cue should return an empty string');

console.log('subtitle editor behavior tests: PASS');
