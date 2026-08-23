import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HEAT_LEVELS,
  SOURCE_CREDIBILITIES,
  TREND_STATUSES,
  createTrendNote,
  updateTrendNote,
  associateProducts,
  associateCategories,
  filterTrendNotes,
  sortTrendNotes,
  summarizeTrendNotes,
} from '../src/features/trends/index.js';

const base = {
  noteId: 'TREND-001',
  keyword: 'soft utility',
  categoryId: 'CAT-TOP',
  productIds: ['SKU-1001'],
  sourcePlatform: '示例观察',
  sourceUrl: 'https://example.com/trends/soft-utility',
  discoveredDate: '2026-08-22',
  heatLevel: '中',
  sourceCredibility: '中',
  status: '待验证',
  observation: '关注柔软面料与功能口袋的结合。',
};

test('creates a normalized trend note with safe defaults', () => {
  const note = createTrendNote({ keyword: '  satin bow ', productId: 'SKU-1003' }, { id: 'TREND-NEW', now: '2026-08-22T10:00:00.000Z' });
  assert.equal(note.noteId, 'TREND-NEW');
  assert.equal(note.keyword, 'satin bow');
  assert.deepEqual(note.productIds, ['SKU-1003']);
  assert.deepEqual(note.categoryIds, []);
  assert.equal(note.heatLevel, '中');
  assert.equal(note.sourceCredibility, '中');
  assert.equal(note.status, '待验证');
  assert.equal(note.createdAt, '2026-08-22T10:00:00.000Z');
  assert.deepEqual(HEAT_LEVELS, ['高', '中', '低']);
  assert.deepEqual(SOURCE_CREDIBILITIES, ['高', '中', '低']);
  assert.ok(TREND_STATUSES.includes('待验证'));
});

test('requires a keyword and preserves immutable updates', () => {
  assert.throws(() => createTrendNote({}), /keyword is required/i);
  const notes = [base];
  const updated = updateTrendNote(notes, 'TREND-001', { observation: '已确认', sourceCredibility: '高' });
  assert.notEqual(updated, notes);
  assert.equal(notes[0].observation, '关注柔软面料与功能口袋的结合。');
  assert.equal(updated[0].sourceCredibility, '高');
  assert.throws(() => updateTrendNote(notes, 'UNKNOWN', { status: '已验证' }), /not found/i);
});

test('associates products and categories without duplicates', () => {
  const withProducts = associateProducts([base], 'TREND-001', ['SKU-1001', 'SKU-1002']);
  assert.deepEqual(withProducts[0].productIds, ['SKU-1001', 'SKU-1002']);
  const withCategories = associateCategories(withProducts, 'TREND-001', ['CAT-TOP', 'CAT-ACC']);
  assert.deepEqual(withCategories[0].categoryIds, ['CAT-TOP', 'CAT-ACC']);
  assert.throws(() => associateProducts([base], 'UNKNOWN', ['SKU-9']), /not found/i);
});

test('filters by query, heat, credibility, status, relationships and date range', () => {
  const notes = [base, { ...base, noteId: 'TREND-002', keyword: 'satin bow', discoveredDate: '2026-08-23', heatLevel: '高', sourceCredibility: '高', status: '已验证', productIds: ['SKU-1003'], categoryIds: ['CAT-ACC'] }];
  assert.deepEqual(filterTrendNotes(notes, { query: 'satin' }).map((item) => item.noteId), ['TREND-002']);
  assert.deepEqual(filterTrendNotes(notes, { heatLevel: '高', dateFrom: '2026-08-23' }).map((item) => item.noteId), ['TREND-002']);
  assert.deepEqual(filterTrendNotes(notes, { sourceCredibility: '高', status: '已验证', productId: 'SKU-1003' }).map((item) => item.noteId), ['TREND-002']);
  assert.deepEqual(filterTrendNotes(notes, { categoryId: 'CAT-TOP', dateTo: '2026-08-22' }).map((item) => item.noteId), ['TREND-001']);
});

test('sorts latest and hottest notes first and summarizes counts', () => {
  const notes = [base, { ...base, noteId: 'TREND-002', discoveredDate: '2026-08-23', heatLevel: '高', status: '已验证', sourceCredibility: '高' }, { ...base, noteId: 'TREND-003', discoveredDate: '2026-08-21', heatLevel: '低', status: '已归档' }];
  assert.deepEqual(sortTrendNotes(notes).map((item) => item.noteId), ['TREND-002', 'TREND-001', 'TREND-003']);
  assert.deepEqual(summarizeTrendNotes(notes), { total: 3, active: 2, highHeat: 1, verified: 1, highCredibility: 1 });
});
