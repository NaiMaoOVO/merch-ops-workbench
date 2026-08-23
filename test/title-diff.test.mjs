import test from 'node:test';
import assert from 'node:assert/strict';

import { diffTitleWords } from '../src/features/title/index.js';

test('diffTitleWords flags candidate words missing from the original', () => {
  const diff = diffTitleWords('Women Top', 'Women Ribbed Square Neck Top');
  assert.deepEqual(diff, [
    { word: 'Women', isNew: false },
    { word: 'Ribbed', isNew: true },
    { word: 'Square', isNew: true },
    { word: 'Neck', isNew: true },
    { word: 'Top', isNew: false },
  ]);
});

test('diff is case-insensitive and tolerates missing originals', () => {
  assert.equal(diffTitleWords('top', 'Top').every((token) => !token.isNew), true);
  assert.deepEqual(diffTitleWords('', 'Knit Top'), [
    { word: 'Knit', isNew: true },
    { word: 'Top', isNew: true },
  ]);
});
