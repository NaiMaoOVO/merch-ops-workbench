import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeDuplicateRows } from '../src/lib/data/index.js';

const row = (over = {}) => ({ productId: 'SKU-1', date: '2026-08-01', impressions: 100, clicks: 10, salesAmount: 50, category: '家居', ...over });

test('同商品同日期累加数值字段', () => {
  const result = mergeDuplicateRows([row(), row({ impressions: 50, clicks: 5, salesAmount: 30 })]);
  assert.equal(result.rows.length, 1);
  assert.equal(result.mergedCount, 1);
  assert.equal(result.rows[0].impressions, 150);
  assert.equal(result.rows[0].clicks, 15);
  assert.equal(result.rows[0].salesAmount, 80);
});

test('不同日期或不同商品不合并', () => {
  const result = mergeDuplicateRows([row(), row({ date: '2026-08-02' }), row({ productId: 'SKU-2' })]);
  assert.equal(result.rows.length, 3);
  assert.equal(result.mergedCount, 0);
});

test('缺键或缺日期的行原样保留', () => {
  const result = mergeDuplicateRows([{ clicks: 3 }, row({ productId: '', date: '' })]);
  assert.equal(result.rows.length, 2);
  assert.equal(result.mergedCount, 0);
});
