export const WEEKLY_BACKUP_META_KEY = 'merch-workbench:weekly-backup-last';
export const RECURRENCE_OPTIONS = ['none', 'daily', 'weekly', 'monthly'];

export function shouldRunWeeklyBackup(lastRun, now = new Date(), intervalDays = 7) {
  if (!lastRun) return true;
  const previous = new Date(lastRun);
  if (Number.isNaN(previous.getTime())) return true;
  return now.getTime() - previous.getTime() >= Math.max(1, intervalDays) * 86400000;
}

export function nextRecurringDate(date, recurrence) {
  const value = new Date(String(date || '') + 'T12:00:00');
  if (Number.isNaN(value.getTime()) || recurrence === 'none' || !RECURRENCE_OPTIONS.includes(recurrence)) return '';
  if (recurrence === 'daily') value.setDate(value.getDate() + 1);
  if (recurrence === 'weekly') value.setDate(value.getDate() + 7);
  if (recurrence === 'monthly') value.setMonth(value.getMonth() + 1);
  return value.toISOString().slice(0, 10);
}

/** 为已完成且到期的循环任务补出下一期，使用 recurrenceKey 避免重复生成。 */
export function materializeRecurringTasks(tasks = [], now = new Date()) {
  const list = Array.isArray(tasks) ? tasks : [];
  const existing = new Set(list.map((task) => task.recurrenceKey).filter(Boolean));
  const additions = [];
  for (const task of list) {
    if (!task.recurrence || task.recurrence === 'none' || task.status !== '已完成' || !task.dueDate) continue;
    const nextDate = nextRecurringDate(task.dueDate, task.recurrence);
    if (!nextDate || new Date(nextDate + 'T23:59:59').getTime() > now.getTime()) continue;
    const key = String(task.id) + ':' + nextDate;
    if (existing.has(key)) continue;
    additions.push({ ...task, id: key, recurrenceKey: key, dueDate: nextDate, status: '待处理', createdAt: now.toISOString(), updatedAt: now.toISOString() });
    existing.add(key);
  }
  return [...list, ...additions];
}
