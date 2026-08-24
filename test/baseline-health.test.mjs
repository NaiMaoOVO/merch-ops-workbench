import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayBrief, daysSinceLastImport } from '../src/lib/analysis/index.js';

test('对比基线可切换为上周同日', () => {
  const trend = [
    { date: '2026-08-05', value: 900 },
    { date: '2026-08-10', value: 1000 },
    { date: '2026-08-11', value: 1200 },
  ];
  const prev = buildTodayBrief({ trend, compareMode: 'prev' });
  assert.equal(prev.changePct, 20);
  const sameDay = buildTodayBrief({ trend, compareMode: 'lastWeekSame' });
  assert.equal(sameDay.changePct, null, '7 天前(8-04)不存在于序列时应无对比');

  const withBase = [...trend, { date: '2026-08-04', value: 1000 }];
  withBase.sort((a, b) => a.date.localeCompare(b.date));
  const brief2 = buildTodayBrief({ trend: withBase, compareMode: 'lastWeekSame' });
  assert.equal(brief2.changePct, 20);
});

test('daysSinceLastImport 计算未导入天数', () => {
  const now = new Date('2026-08-20T12:00:00');
  assert.equal(daysSinceLastImport([{ date: '2026-08-19', value: 1 }], now), 0);
  assert.equal(daysSinceLastImport([{ date: '2026-08-15', value: 1 }], now), 4);
  assert.equal(daysSinceLastImport([], now), null);
});
