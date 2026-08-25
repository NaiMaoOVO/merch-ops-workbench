const PRIORITIES = ['高', '中', '低'];
const TERMINAL_STATUSES = new Set(['已完成', '已取消', '已关闭', '已解决', '已忽略']);
const STATUS_BY_ACTION = { start: '进行中', complete: '已完成', defer: '已延期', cancel: '已取消', reopen: '待处理' };

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).length === 10 ? `${value}T23:59:59` : value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function createTask(input = {}, options = {}) {
  const title = String(input.title ?? '').trim();
  if (!title) throw new Error('Task title is required');
  const now = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? input.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    description: String(input.description ?? ''),
    priority: PRIORITIES.includes(input.priority) ? input.priority : '中',
    status: input.status ?? '待处理',
    dueDate: input.dueDate || '',
    category: input.category || '日常任务',
    recurrence: ['none', 'daily', 'weekly', 'monthly'].includes(input.recurrence) ? input.recurrence : 'none',
    source: input.source || 'manual',
    relatedId: input.relatedId ?? null,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function updateTaskStatus(task, status, updatedAt = new Date().toISOString()) {
  if (!task || !status) throw new Error('Task and status are required');
  return { ...task, status, updatedAt };
}

export function transitionTask(task, action, updatedAt = new Date().toISOString()) {
  const status = STATUS_BY_ACTION[action];
  if (!status) throw new Error(`Unknown task transition: ${action}`);
  return updateTaskStatus(task, status, updatedAt);
}

export function isTaskOverdue(task, now = new Date()) {
  if (!task?.dueDate || TERMINAL_STATUSES.has(task.status)) return false;
  const dueDate = asDate(task.dueDate);
  const nowDate = asDate(now);
  return Boolean(dueDate && nowDate && dueDate < nowDate && !TERMINAL_STATUSES.has(task.status));
}

export function sortTasks(tasks = [], now = new Date()) {
  const priorityRank = { 高: 0, 中: 1, 低: 2 };
  return [...tasks].sort((a, b) => {
    const overdueDiff = Number(isTaskOverdue(b, now)) - Number(isTaskOverdue(a, now));
    if (overdueDiff) return overdueDiff;
    const terminalDiff = Number(TERMINAL_STATUSES.has(a.status)) - Number(TERMINAL_STATUSES.has(b.status));
    if (terminalDiff) return terminalDiff;
    const priorityDiff = (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
    if (priorityDiff) return priorityDiff;
    const aDue = asDate(a.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDue = asDate(b.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
}

export function filterTasks(tasks = [], options = {}) {
  const query = String(options.query ?? '').trim().toLowerCase();
  return tasks.filter((task) => {
    if (options.status && options.status !== '全部' && task.status !== options.status) return false;
    if (options.priority && options.priority !== '全部' && task.priority !== options.priority) return false;
    if (options.overdue && !isTaskOverdue(task, options.now ?? new Date())) return false;
    if (query && ![task.title, task.description, task.category].some((value) => String(value ?? '').toLowerCase().includes(query))) return false;
    return true;
  });
}

export function summarizeTasks(tasks = [], now = new Date()) {
  return {
    total: tasks.length,
    actionable: tasks.filter((task) => !TERMINAL_STATUSES.has(task.status)).length,
    completed: tasks.filter((task) => task.status === '已完成').length,
    overdue: tasks.filter((task) => isTaskOverdue(task, now)).length,
    highPriority: tasks.filter((task) => task.priority === '高' && !TERMINAL_STATUSES.has(task.status)).length,
  };
}

export function collectDashboardTasks({ tasks = [], diagnostics = [], supplierIssues = [], now = new Date() } = {}) {
  const diagnosticTasks = diagnostics.filter((item) => !TERMINAL_STATUSES.has(item.status)).map((item) => createTask({
    id: item.id,
    title: item.finding || item.title || '待确认策略诊断',
    description: item.suggestedAction || '',
    priority: item.priority,
    status: item.status || '待确认',
    category: '策略诊断',
    source: 'diagnostic',
    relatedId: item.id,
    dueDate: item.dueDate,
    createdAt: item.createdAt,
  }, { now: item.updatedAt || now, id: item.id }));
  const issueTasks = supplierIssues.filter((item) => !TERMINAL_STATUSES.has(item.status)).map((item) => createTask({
    ...item,
    title: item.title || item.subject || '供应商问题',
    category: '供应商问题',
    source: 'supplier-issue',
    relatedId: item.id,
  }, { now: item.updatedAt || now, id: item.id }));
  const manualTasks = tasks.map((item) => createTask({ ...item, source: item.source || 'manual' }, { now: item.updatedAt || now, id: item.id }));
  return sortTasks([...diagnosticTasks, ...issueTasks, ...manualTasks], now);
}

export { PRIORITIES, TERMINAL_STATUSES };
