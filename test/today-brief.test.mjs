import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTodayBrief } from '../src/lib/analysis/index.js';

test('取最近两日计算环比，并按优先级取异常 Top3', () => {
  const brief = buildTodayBrief({
    trend: [{ date: '2026-08-01', value: 1000 }, { date: '2026-08-02', value: 800 }],
    diagnostics: [
      { id: 'd1', finding: '低转化', priority: '低' },
      { id: 'd2', finding: '点击率崩了', priority: '高' },
      { id: 'd3', finding: '中优问题', priority: '中' },
      { id: 'd4', finding: '已解决项', priority: '高', status: '已解决' },
    ],
    tasks: [],
    now: new Date('2026-08-03T10:00:00'),
  });
  assert.equal(brief.yesterdayValue, 800);
  assert.equal(brief.changePct, -20);
  assert.deepEqual(brief.topIssues.map((item) => item.finding), ['点击率崩了', '中优问题', '低转化']);
});

test('今日到期与逾期任务分开统计', () => {
  const brief = buildTodayBrief({
    trend: [],
    diagnostics: [],
    tasks: [
      { dueDate: '2026-08-03', status: '进行中' },
      { dueDate: '2026-08-01', status: '进行中' },
      { dueDate: '2026-08-03', status: '已完成' },
    ],
    now: new Date('2026-08-03T10:00:00'),
  });
  assert.equal(brief.dueToday, 1);
  assert.equal(brief.overdue, 1);
  assert.equal(brief.yesterdayValue, null);
});
