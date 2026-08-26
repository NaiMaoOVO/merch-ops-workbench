import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocalDigest } from '../src/lib/analysis/local-digest.js';

test('本地摘要：含销售额/环比/异常/事件', () => {
  const text = buildLocalDigest({
    totals: { salesAmount: 1200, impressions: 5000, clicks: 100, paid: 30 },
    comparison: [{ metric: 'salesAmount', previous: 1000, current: 1200, changeLabel: '+20.0%' }],
    diagnostics: [{ status: '待处理', priority: '高' }, { status: '待处理', priority: '中' }, { status: '已解决', priority: '低' }],
    annotations: { '2026-08-01': '大促' },
    period: '本周',
  });
  assert.match(text, /销售额 ¥1,200/);
  assert.match(text, /点击率 2\.00%/);
  assert.match(text, /销售额环比：\+20\.0%/);
  assert.match(text, /待处理异常 2 条/);
  assert.match(text, /2026-08-01（大促）/);
});

test('空数据返回空串', () => {
  assert.equal(buildLocalDigest({}), '');
});
