import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTask,
  transitionTask,
  updateTaskStatus,
  isTaskOverdue,
  sortTasks,
  filterTasks,
  summarizeTasks,
  collectDashboardTasks,
} from '../src/features/tasks/index.js';

const NOW = '2026-08-22T10:00:00.000Z';

test('creates a normalized task with safe defaults and stable fields', () => {
  const task = createTask({ title: '检查标题', dueDate: '2026-08-23', priority: '高' }, { now: NOW, id: 'task-1' });

  assert.deepEqual(task, {
    id: 'task-1',
    title: '检查标题',
    description: '',
    priority: '高',
    status: '待处理',
    dueDate: '2026-08-23',
    category: '日常任务',
    source: 'manual',
    relatedId: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
});

test('rejects blank task titles and normalizes unsupported priority', () => {
  assert.throws(() => createTask({ title: '  ' }), /title/i);
  assert.equal(createTask({ title: '补货', priority: 'urgent' }, { now: NOW, id: 'task-2' }).priority, '中');
});

test('transitions tasks immutably and records the update time', () => {
  const task = createTask({ title: '跟进供应商' }, { now: NOW, id: 'task-3' });
  const completed = transitionTask(task, 'complete', '2026-08-22T11:00:00.000Z');
  const deferred = transitionTask(completed, 'defer', '2026-08-22T12:00:00.000Z');

  assert.equal(task.status, '待处理');
  assert.equal(completed.status, '已完成');
  assert.equal(completed.updatedAt, '2026-08-22T11:00:00.000Z');
  assert.equal(deferred.status, '已延期');
  assert.equal(updateTaskStatus(task, '进行中', '2026-08-22T13:00:00.000Z').status, '进行中');
  assert.throws(() => transitionTask(task, 'unknown', NOW), /transition/i);
});

test('detects overdue tasks only when actionable', () => {
  assert.equal(isTaskOverdue({ dueDate: '2026-08-21', status: '待处理' }, NOW), true);
  assert.equal(isTaskOverdue({ dueDate: '2026-08-22', status: '待处理' }, NOW), false);
  assert.equal(isTaskOverdue({ dueDate: '2026-08-21', status: '已完成' }, NOW), false);
  assert.equal(isTaskOverdue({ dueDate: '', status: '待处理' }, NOW), false);
});

test('sorts actionable tasks by overdue, priority, then due date', () => {
  const tasks = [
    { id: 'low', title: '低', priority: '低', status: '待处理', dueDate: '2026-08-23' },
    { id: 'high', title: '高', priority: '高', status: '待处理', dueDate: '2026-08-23' },
    { id: 'overdue', title: '逾期', priority: '低', status: '待处理', dueDate: '2026-08-21' },
    { id: 'done', title: '完成', priority: '高', status: '已完成', dueDate: '2026-08-20' },
  ];

  assert.deepEqual(sortTasks(tasks, NOW).map((task) => task.id), ['overdue', 'high', 'low', 'done']);
  assert.deepEqual(tasks.map((task) => task.id), ['low', 'high', 'overdue', 'done']);
});

test('filters by status, priority, overdue, and search query', () => {
  const tasks = [
    { id: 'a', title: '审核标题候选', priority: '高', status: '待处理', dueDate: '2026-08-21' },
    { id: 'b', title: '整理周报', priority: '中', status: '进行中', dueDate: '2026-08-24' },
  ];
  assert.deepEqual(filterTasks(tasks, { overdue: true, now: NOW }).map((task) => task.id), ['a']);
  assert.deepEqual(filterTasks(tasks, { status: '进行中' }).map((task) => task.id), ['b']);
  assert.deepEqual(filterTasks(tasks, { priority: '高', query: '标题' }).map((task) => task.id), ['a']);
});

test('summarizes task counts for the dashboard', () => {
  const tasks = [
    { id: 'a', title: 'A', priority: '高', status: '待处理', dueDate: '2026-08-21' },
    { id: 'b', title: 'B', priority: '中', status: '进行中', dueDate: '2026-08-23' },
    { id: 'c', title: 'C', priority: '低', status: '已完成', dueDate: '2026-08-20' },
  ];
  assert.deepEqual(summarizeTasks(tasks, NOW), { total: 3, actionable: 2, completed: 1, overdue: 1, highPriority: 1 });
});

test('collects open diagnostic and supplier issue items as dashboard tasks', () => {
  const result = collectDashboardTasks({
    tasks: [{ id: 'manual', title: '手动事项', status: '待处理', priority: '低', dueDate: '2026-08-23' }],
    diagnostics: [{ id: 'd-1', finding: 'SKU-1 高曝光低点击', priority: '高', status: '待确认', suggestedAction: '检查标题' }, { id: 'd-2', finding: '已忽略', priority: '中', status: '已忽略' }],
    supplierIssues: [{ id: 's-1', title: '库存反馈', priority: '中', status: '处理中', dueDate: '2026-08-24' }, { id: 's-2', title: '已解决', priority: '高', status: '已解决' }],
    now: NOW,
  });

  assert.deepEqual(result.map((task) => [task.id, task.source, task.title]), [
    ['d-1', 'diagnostic', 'SKU-1 高曝光低点击'],
    ['s-1', 'supplier-issue', '库存反馈'],
    ['manual', 'manual', '手动事项'],
  ]);
});
