import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateTitleCandidates,
  generateBilingualCandidates,
  validateTitle,
  updateReviewStatus,
  getApprovedTitles,
} from '../src/features/title/index.js';

const product = {
  productId: 'SKU-1001',
  productName: 'Ribbed Square Neck Top',
  category: 'Tops',
  categoryZh: '上装',
  facts: 'ribbed knit; square neck; slim fit; short sleeve',
  keywords: 'ribbed top, square neck, slim fit',
};

test('generates deterministic English candidates from product facts', () => {
  const candidates = generateTitleCandidates(product, { language: 'en', count: 3 });

  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((candidate) => candidate.language === 'en'));
  assert.ok(candidates.every((candidate) => candidate.productId === product.productId));
  assert.ok(candidates.some((candidate) => /ribbed/i.test(candidate.text)));
  assert.ok(candidates.every((candidate) => candidate.factsUsed.length > 0));
});

test('generates Chinese and English candidates from one shared fact set', () => {
  const candidates = generateBilingualCandidates(product, { count: 2 });

  assert.equal(candidates.length, 4);
  assert.deepEqual(new Set(candidates.map((candidate) => candidate.language)), new Set(['en', 'zh']));
  assert.ok(candidates.some((candidate) => candidate.language === 'zh' && /上装|针织|方领/.test(candidate.text)));
});

test('validates length, banned words, fact consistency, and duplicate words', () => {
  const invalid = validateTitle(
    {
      text: 'Ribbed Ribbed Top waterproof',
      language: 'en',
      factsUsed: ['ribbed knit', 'waterproof'],
    },
    product,
    { maxLength: 80, bannedWords: ['waterproof'] },
  );

  assert.equal(invalid.valid, false);
  assert.equal(invalid.checks.length.valid, true);
  assert.equal(invalid.checks.bannedWords.valid, false);
  assert.equal(invalid.checks.factConsistency.valid, false);
  assert.equal(invalid.checks.duplicateWords.valid, false);
  assert.ok(invalid.issues.length >= 3);
});

test('accepts a generated title when it meets configured checks', () => {
  const candidate = generateTitleCandidates(product, { language: 'en', count: 1 })[0];
  const result = validateTitle(candidate, product, { maxLength: 120 });

  assert.equal(result.valid, true);
  assert.ok(Object.values(result.checks).every((check) => check.valid));
});

test('updates review status immutably and exports approved titles only', () => {
  const items = [
    { id: 'a', productId: 'SKU-1001', text: 'A', reviewStatus: '待审核' },
    { id: 'b', productId: 'SKU-1002', text: 'B', reviewStatus: '待审核' },
  ];

  const reviewed = updateReviewStatus(items, 'a', '已通过');

  assert.notEqual(reviewed, items);
  assert.equal(items[0].reviewStatus, '待审核');
  assert.equal(reviewed[0].reviewStatus, '已通过');
  assert.deepEqual(getApprovedTitles(reviewed), [reviewed[0]]);
  assert.throws(() => updateReviewStatus(items, 'a', '未知状态'), /Unsupported review status/);
});
