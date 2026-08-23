import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTaskResolutions } from '../src/lib/associations/index.js';

const diag = (id, status = '待确认') => ({ id, status, finding: '点击率偏低' });
const doneTask = (sourceId) => ({ id: 't-' + sourceId, status: '已完成', sourceDiagnosticId: sourceId });

test('已完成任务自动解决对应诊断', () => {
  const result = applyTaskResolutions([diag('d1'), diag('d2')], [doneTask('d1')]);
  assert.equal(result[0].status, '已解决');
  assert.equal(result[1].status, '待确认');
});

test('未完成或无关联的任务不影响诊断状态', () => {
  const openTask = { id: 't-x', status: '进行中', sourceDiagnosticId: 'd1' };
  const noLink = { id: 't-y', status: '已完成' };
  const result = applyTaskResolutions([diag('d1', '已确认')], [openTask, noLink]);
  assert.equal(result[0].status, '已确认');
});
