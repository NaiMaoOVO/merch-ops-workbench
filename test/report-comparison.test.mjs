import test from 'node:test';
import assert from 'node:assert/strict';
import { createReportDraft, renderReportMarkdown } from '../src/features/report/index.js';

const report = {
  id: 'r1',
  period: '8 月第 2 周',
  comparison: [
    { metric: 'salesAmount', previous: 1000, current: 1200, changeLabel: '+20.0%' },
    { metric: 'clicks', previous: 0, current: 50, changeLabel: '无基数' },
    { bad: true },
  ],
};

test('createReportDraft 归一化双周期对比数据', () => {
  const draft = createReportDraft(report);
  assert.equal(draft.comparison.length, 2);
  assert.deepEqual(draft.comparison[0], { metric: 'salesAmount', previous: 1000, current: 1200, changeLabel: '+20.0%' });
});

test('renderReportMarkdown 输出双周期对比表', () => {
  const markdown = renderReportMarkdown(createReportDraft(report));
  assert.match(markdown, /## 双周期对比/);
  assert.match(markdown, /\| salesAmount \| 1,000 \| 1,200 \| \+20\.0% \|/);
  assert.match(markdown, /\| clicks \| 0 \| 50 \| 无基数 \|/);
});
