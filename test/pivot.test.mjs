import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFunnel, buildPivot } from '../src/lib/analysis/pivot.js';

test('buildPivot groups measures and calculates safe rates', () => {
  const result = buildPivot([{ category: '上装', impressions: 100, clicks: 10, paid: 2 }, { category: '上装', impressions: 50, clicks: 5, paid: 1 }], { groupBy: 'category', measures: ['impressions', 'clicks', 'paid'] });
  assert.deepEqual(result[0], { group: '上装', impressions: 150, clicks: 15, paid: 3, clickRate: 0.1, conversionRate: 0.2 });
});

test('buildFunnel returns ordered funnel stages', () => {
  assert.deepEqual(buildFunnel([{ impressions: 10, clicks: 4, addToCart: 2, paid: 1 }]).map((item) => item.value), [10, 4, 2, 1]);
});
