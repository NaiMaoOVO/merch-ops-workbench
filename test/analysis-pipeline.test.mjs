import test from 'node:test';
import assert from 'node:assert/strict';

import { parseSpreadsheet, validateFieldMapping } from '../src/lib/data/index.js';
import { buildImportedAnalysis } from '../src/lib/analysis/index.js';
import { computeDerivedMetrics, evaluateRules, createRule, filterAnalysisRows } from '../src/lib/analysis/metrics.js';
import { bulkUpdateReviewStatus } from '../src/features/title/index.js';

const CSV_TRAFFIC = '日期,商品ID,曝光量,点击量\n2026-08-24,A,2000,60\n2026-08-24,B,500,80\n2026-08-23,A,1500,45';
const CSV_SALES = '\uFEFF日期,商品ID,支付件数,销售额\n2026-08-24,A,3,90\n2026-08-24,B,30,600\n2026-08-23,A,2,60';

test('end-to-end：CSV 导入 → 字段识别 → 合并 → 指标 → 规则命中', async () => {
  const [traffic] = await parseSpreadsheet(CSV_TRAFFIC, { format: 'csv', name: '流量.csv' });
  const [sales] = await parseSpreadsheet(CSV_SALES, { format: 'csv', name: '销售.csv' });
  assert.deepEqual(traffic.headers, ['日期', '商品ID', '曝光量', '点击量']); // BOM 已剥离

  const merged = buildImportedAnalysis(
    [
      { fileName: '流量.csv', name: traffic.name, headers: traffic.headers, rows: traffic.rows },
      { fileName: '销售.csv', name: sales.name, headers: sales.headers, rows: sales.rows },
    ],
    {},
  );
  assert.equal(merged.reason, '');
  assert.equal(merged.rows.length, 3);

  const latestDay = filterAnalysisRows(merged.rows, { dateFrom: '2026-08-24' });
  assert.equal(latestDay.length, 2);

  const metrics = computeDerivedMetrics(latestDay);
  const productB = metrics.find((row) => row.productId === 'B');
  assert.equal(productB.conversionRate, 0.375);
  const productA = metrics.find((row) => row.productId === 'A');
  assert.ok(Math.abs(productA.clickRate - 0.03) < 1e-9);

  const lowCvr = createRule({ id: 'low-cvr', label: '低转化', metric: 'clickRate', operator: 'lt', threshold: 0.04 });
  const hits = evaluateRules(latestDay, [lowCvr]);
  assert.ok(hits.some((hit) => hit.productId === 'A'));
  assert.ok(!hits.some((hit) => hit.productId === 'B'));
});

test('end-to-end：错误映射被校验拦截，不进入分析', () => {
  const bad = validateFieldMapping({ productId: '商品ID', impressions: '商品ID' }, { requiredTargets: ['productId', 'impressions'] });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.some((error) => error.code === 'duplicate-source'));
});

test('end-to-end：标题批量审核只影响勾选项，导出仍以已通过为准', () => {
  const items = [
    { id: 't1', reviewStatus: '待审核' },
    { id: 't2', reviewStatus: '待审核' },
    { id: 't3', reviewStatus: '已通过' },
  ];
  const next = bulkUpdateReviewStatus(items, ['t1'], '已通过');
  assert.deepEqual(next.map((item) => item.reviewStatus), ['已通过', '待审核', '已通过']);
  assert.equal(items[0].reviewStatus, '待审核'); // 原列表不可变
});
