import test from 'node:test';
import assert from 'node:assert/strict';

import { matchTables, suggestJoinKeys } from '../src/lib/data/index.js';

test('suggestJoinKeys matches normalised header names across sheets', () => {
  const suggestions = suggestJoinKeys(['商品 ID', '日期', '曝光量'], ['product_id', '统计日期', '销售额']);
  assert.deepEqual(suggestions, []); // 中英不同名或纯中文名不硬凑，交给人工选择
  const same = suggestJoinKeys([' 商品ID ', '日期'], ['商品ID', '销售额']);
  assert.deepEqual(same, [{ left: ' 商品ID ', right: '商品ID' }]); // 纯中文「日期」规范化为空，跳过
});

test('matchTables previews a real join with unmatched and duplicate reporting', () => {
  const primary = { headers: ['商品ID', '曝光'], rows: [{ 商品ID: 'A', 曝光: 10 }, { 商品ID: 'B', 曝光: 20 }, { 商品ID: '', 曝光: 1 }] };
  const secondary = { headers: ['商品ID', '品类'], rows: [{ 商品ID: 'A', 品类: '上装' }, { 商品ID: 'A', 品类: '促销' }, { 商品ID: 'C', 品类: '配饰' }] };
  const result = matchTables(primary, secondary, { primaryKey: '商品ID', secondaryKey: '商品ID' });
  assert.equal(result.report.outputRowCount, 4); // A 一对多扩展为 2 行，B 未匹配保留，空键保留
  assert.equal(result.report.unmatchedPrimaryKeys.length, 1);
  assert.deepEqual(result.report.duplicateSecondaryKeys, ['A']);
  assert.equal(result.report.rowCountInflation, 1);
});
