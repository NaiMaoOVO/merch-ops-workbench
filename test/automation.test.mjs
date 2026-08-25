import test from 'node:test';
import assert from 'node:assert/strict';
import { materializeRecurringTasks, nextRecurringDate, shouldRunWeeklyBackup } from '../src/lib/automation/index.js';

test('每周备份到期判断', () => {
  assert.equal(shouldRunWeeklyBackup(null, new Date('2026-08-24')), true);
  assert.equal(shouldRunWeeklyBackup('2026-08-20', new Date('2026-08-24')), false);
  assert.equal(shouldRunWeeklyBackup('2026-08-10', new Date('2026-08-24')), true);
});

test('循环日期与已完成任务续期', () => {
  assert.equal(nextRecurringDate('2026-08-24', 'weekly'), '2026-08-31');
  const tasks = [{ id: 't1', title: '导入周报', status: '已完成', dueDate: '2026-08-10', recurrence: 'weekly' }];
  const next = materializeRecurringTasks(tasks, new Date('2026-08-24T12:00:00'));
  assert.equal(next.length, 2);
  assert.equal(next[1].dueDate, '2026-08-17');
  assert.equal(materializeRecurringTasks(next, new Date('2026-08-24T12:00:00')).length, 2);
});
