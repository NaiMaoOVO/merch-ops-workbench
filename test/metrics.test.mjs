import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTrendSeries,
  computeDerivedMetrics,
  computePeriodComparison,
  createRule,
  evaluateRules,
  filterAnalysisRows,
} from '../src/lib/analysis/metrics.js';

const rows = [
  { date: '2026-08-24', category: '上装', site: 'US', impressions: 1000, clicks: 50, addToCart: 10, paid: 5, salesAmount: 250 },
  { date: '2026-08-23', category: '下装', site: 'UK', impressions: 800, clicks: 40, addToCart: 4, paid: 2, salesAmount: 100 },
];

test('derived metrics keep formulas explicit and never divide by zero', () => {
  const computed = computeDerivedMetrics([...rows, { date: '2026-08-22' }]);
  const row = computed[0];
  const empty = computed[2];
  assert.equal(row.clickRate, 0.05);
  assert.equal(row.conversionRate, 0.1);
  assert.equal(row.addCartRate, 0.2);
  assert.equal(row.aov, 50);
  assert.equal(empty.clickRate, 0);
  assert.equal(empty.aov, 0);
});

test('filter by date range and dimensions', () => {
  const filtered = filterAnalysisRows(rows, { dateFrom: '2026-08-24', category: '上装' });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].site, 'US');
  assert.equal(filterAnalysisRows(rows, {}).length, 2);
});

test('trend series sorts dates ascending and sums the metric', () => {
  assert.deepEqual(buildTrendSeries(rows), [
    { date: '2026-08-23', value: 100 },
    { date: '2026-08-24', value: 250 },
  ]);
});

test('period comparison reports change with a readable label', () => {
  const comparison = computePeriodComparison([rows[0]], [rows[1]], ['salesAmount']);
  assert.equal(comparison[0].current, 250);
  assert.equal(comparison[0].previous, 100);
  assert.equal(comparison[0].changeLabel, '+150.0%');
  const noBase = computePeriodComparison([], [{ paid: 0 }], ['paid']);
  assert.equal(noBase[0].changeLabel, '无基数');
});

test('configurable rules support absolute and quantile thresholds plus scope', () => {
  const lowClick = createRule({ id: 'high-impression-low-click', metric: 'clickRate', operator: 'lt', threshold: 0.06 });
  const highImpression = createRule({ id: 'top-impression', label: '曝光 P70', metric: 'impressions', operator: 'gte', quantileRatio: 0.7 });
  const scoped = createRule({ id: 'us-low-cvr', metric: 'conversionRate', operator: 'lt', threshold: 0.15, scope: { site: 'US' } });
  const hits = evaluateRules(rows, [lowClick, highImpression, scoped]);
  const rules = hits.map((hit) => hit.rule);
  assert.ok(rules.includes('high-impression-low-click'));
  assert.ok(rules.includes('top-impression'));
  assert.ok(rules.includes('us-low-cvr'));
  assert.ok(hits.every((hit) => hit.site === 'US' || hit.rule !== 'us-low-cvr'));
  assert.throws(() => createRule({ id: 'bad', metric: 'x', operator: 'nope', threshold: 1 }), /操作符/);
});
