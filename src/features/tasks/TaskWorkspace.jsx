import { useMemo, useState } from 'react';
import { CalendarClock, Check, Circle, Clock3, ListFilter, Plus, Search, Sparkles } from 'lucide-react';
import {
  collectDashboardTasks,
  createTask,
  filterTasks,
  isTaskOverdue,
  sortTasks,
  summarizeTasks,
  transitionTask,
} from './index.js';
import './tasks.css';

const today = () => new Date().toISOString().slice(0, 10);

function TaskStats({ summary }) {
  return (
    <div className="task-stats" aria-label="任务概览">
      <div><strong>{summary.actionable}</strong><span>待处理</span></div>
      <div><strong className={summary.overdue ? 'task-danger' : ''}>{summary.overdue}</strong><span>已逾期</span></div>
      <div><strong>{summary.highPriority}</strong><span>高优先级</span></div>
      <div><strong>{summary.completed}</strong><span>已完成</span></div>
    </div>
  );
}

function TaskRow({ task, now, onTransition }) {
  const overdue = isTaskOverdue(task, now);
  const terminal = task.status === '已完成' || task.status === '已取消';
  return (
    <article className={`task-work-row ${overdue ? 'is-overdue' : ''} ${terminal ? 'is-complete' : ''}`}>
      <button
        className="task-status-button"
        aria-label={`${terminal ? '重新打开' : '完成'}${task.title}`}
        title={terminal ? '重新打开' : '标记完成'}
        onClick={() => onTransition(task, terminal ? 'reopen' : 'complete')}
      >
        {terminal ? <Check size={15} /> : <Circle size={15} />}
      </button>
      <div className="task-work-copy">
        <strong>{task.title}</strong>
        <span>{task.category || '日常任务'}{task.projectId ? ` · 项目 ${task.projectId}` : ''}{task.description ? ` · ${task.description}` : ''}</span>
      </div>
      <span className={`task-priority priority-${task.priority}`}>{task.priority}</span>
      <span className={`task-due ${overdue ? 'task-danger' : ''}`}>
        <CalendarClock size={14} />{task.dueDate || '未设置截止日期'}{overdue ? ' · 逾期' : ''}
      </span>
      <span className="task-row-status">{task.status}</span>
      {!terminal && (
        <button className="task-defer-button" onClick={() => onTransition(task, 'defer')}>
          <Clock3 size={14} />延期
        </button>
      )}
    </article>
  );
}

export default function TaskWorkspace({ tasks: initialTasks = [], diagnostics = [], supplierIssues = [], onChange }) {
  const [tasks, setTasks] = useState(() => collectDashboardTasks({ tasks: initialTasks, diagnostics, supplierIssues }));
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部');
  const [priority, setPriority] = useState('全部');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: '中', dueDate: today(), recurrence: 'none' });
  const now = useMemo(() => new Date(), [tasks]);
  const summary = useMemo(() => summarizeTasks(tasks, now), [tasks, now]);
  const visibleTasks = useMemo(() => sortTasks(filterTasks(tasks, { query, status, priority, overdue: overdueOnly, now }), now), [tasks, query, status, priority, overdueOnly, now]);

  function commit(next) {
    setTasks(next);
    onChange?.(next);
  }

  function handleCreate(event) {
    event.preventDefault();
    try {
      const task = createTask(form);
      commit(sortTasks([task, ...tasks], now));
      setForm({ title: '', description: '', priority: '中', dueDate: today(), recurrence: 'none' });
      setShowForm(false);
    } catch {
      // The required title field provides the visible validation state.
    }
  }

  function handleTransition(task, action) {
    commit(tasks.map((item) => (item.id === task.id ? transitionTask(item, action) : item)));
  }

  return (
    <main className="tasks-workspace" data-testid="tasks-workspace">
      <section className="tasks-hero glass-card">
        <div>
          <span className="eyebrow"><ListFilter size={14} /> DAILY OPS · 日常事项</span>
          <h1>把今天要推进的事，放在一个清单里。</h1>
          <p>异常诊断、供应商问题和临时事项会自动汇总；每一步都可以手动调整。</p>
        </div>
        <button className="primary-button" onClick={() => setShowForm((value) => !value)}><Plus size={16} />新建任务</button>
      </section>

      <TaskStats summary={summary} />

      <section className="tasks-panel glass-card">
        <div className="tasks-toolbar">
          <label className="tasks-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任务、分类或描述" aria-label="搜索任务" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="按状态筛选"><option>全部</option><option>待处理</option><option>进行中</option><option>已延期</option><option>已完成</option></select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="按优先级筛选"><option>全部</option><option>高</option><option>中</option><option>低</option></select>
          <label className="overdue-toggle"><input type="checkbox" checked={overdueOnly} onChange={(event) => setOverdueOnly(event.target.checked)} />只看逾期</label>
        </div>

        {showForm && (
          <form className="task-create-form" onSubmit={handleCreate}>
            <input autoFocus required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="任务名称，例如：确认高曝光低点击商品" aria-label="任务名称" />
            <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="补充说明（可选）" aria-label="任务说明" />
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} aria-label="任务优先级"><option>高</option><option>中</option><option>低</option></select>
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} aria-label="截止日期" />
            <select value={form.recurrence} onChange={(event) => setForm({ ...form, recurrence: event.target.value })} aria-label="重复规则"><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select>
            <button className="secondary-button" type="submit"><Check size={15} />添加</button>
          </form>
        )}

        <div className="tasks-list" aria-live="polite">
          {visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} now={now} onTransition={handleTransition} />) : <div className="tasks-empty"><Sparkles size={19} /><span>当前筛选下没有任务。</span></div>}
        </div>
      </section>
    </main>
  );
}

export { TaskStats, TaskRow };
