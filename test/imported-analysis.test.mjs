import test from 'node:test';
import assert from 'node:assert/strict';

import { buildImportedAnalysis } from '../src/lib/analysis/index.js';

test('buildImportedAnalysis joins imported traffic and sales by product and date', () => {
  const result = buildImportedAnalysis([
    { headers: ['日期', '商品ID', '曝光量', '点击量'], rows: [{ 日期: '2026-08-24', 商品ID: 'A', 曝光量: 100, 点击量: 10 }] },
    { headers: ['日期', '商品ID', '支付件数', '销售额'], rows: [{ 日期: '2026-08-24', 商品ID: 'A', 支付件数: 2, 销售额: 20 }] },
  ]);
  assert.equal(result.reason, '');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].paid, 2);
  assert.equal(result.rows[0].salesAmount, 20);
  assert.equal(result.rows[0].clickRate, undefined);
});

test('buildImportedAnalysis reports missing analysis fields instead of fabricating output', () => {
  const result = buildImportedAnalysis([{ headers: ['名称'], rows: [{ 名称: '商品 A' }] }]);
  assert.equal(result.rows.length, 0);
  assert.match(result.reason, /至少需要/);
});
