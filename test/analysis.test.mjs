import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateBy, detectAnomalies, buildDiagnostic } from '../src/lib/analysis/index.js';

const rows = [
  { productId: 'A', category: 'tops', impressions: 1000, clicks: 20, paid: 1, salesAmount: 30 },
  { productId: 'B', category: 'tops', impressions: 100, clicks: 10, paid: 4, salesAmount: 120 },
  { productId: 'C', category: 'bottoms', impressions: 800, clicks: 8, paid: 1, salesAmount: 20 },
];

test('aggregateBy groups rows and calculates safe rates', () => {
  const result = aggregateBy(rows, 'category');
  assert.equal(result.find((item) => item.group === 'tops').impressions, 1100);
  assert.equal(result.find((item) => item.group === 'tops').clickRate, 30 / 1100);
  assert.equal(result.find((item) => item.group === 'bottoms').conversionRate, 1 / 8);
});

test('detectAnomalies identifies high-impression low-click and low-conversion rows', () => {
  const anomalies = detectAnomalies(rows, { impressionQuantile: 0.6, lowClickRate: 0.03, lowConversionRate: 0.1 });
  assert.ok(anomalies.some((item) => item.productId === 'A' && item.rule === 'high-impression-low-click'));
  assert.ok(anomalies.some((item) => item.productId === 'C' && item.rule === 'high-impression-low-click'));
  assert.ok(anomalies.some((item) => item.productId === 'A' && item.rule === 'low-conversion'));
});

test('buildDiagnostic keeps evidence separate from AI hypothesis', () => {
  const diagnostic = buildDiagnostic(anomaliesForTest(), { hypothesis: '标题卖点可能不够清晰' });
  assert.equal(diagnostic.status, '待确认');
  assert.equal(diagnostic.hypothesis.isAiAssisted, true);
  assert.deepEqual(diagnostic.evidence.fields, ['impressions', 'clickRate', 'conversionRate']);
});

function anomaliesForTest() {
  return { productId: 'A', rule: 'high-impression-low-click', impressions: 1000, clickRate: 0.02, conversionRate: 0.05 };
}
