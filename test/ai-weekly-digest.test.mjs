import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklyDigestRequest, parseWeeklyDigest } from '../src/lib/ai/index.js';

test('周报摘要请求只包含脱敏汇总与事件标签', () => {
  const request = buildWeeklyDigestRequest({ totals: { salesAmount: 1200, clicks: 30, secret: 'x' }, comparison: [{ metric: '销售额', previous: 1000, current: 1200, changeLabel: '+20%' }], annotations: [{ date: '2026-08-01', label: '大促' }], period: '本周' });
  assert.equal(request.maskedSummary.totals.salesAmount, 1200);
  assert.equal(request.maskedSummary.totals.secret, undefined);
  assert.equal(request.preview.sensitiveFieldsExcluded, true);
  assert.match(request.messages[1].content, /大促/);
});

test('摘要解析限制三条并统一待审核标记', () => {
  const result = parseWeeklyDigest('- 销售额增长\n2. 待审核摘要：点击率稳定\n3. 异常需复盘\n4. 丢弃');
  assert.equal(result.split('\n').length, 3);
  assert.match(result, /待审核摘要：销售额增长/);
  assert.doesNotMatch(result, /丢弃/);
});
