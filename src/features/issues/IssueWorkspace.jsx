import React, { useMemo, useState } from 'react';
import {
  ISSUE_PRIORITIES,
  ISSUE_STATUSES,
  ISSUE_TYPES,
  createIssue,
  filterIssues,
  getIssueSummary,
  isOverdue,
  transitionIssue,
  updateIssue,
} from './index.js';
import './issues-workspace.css';

const emptyDraft = { supplierId: '', productId: '', title: '', type: '其他', priority: '中', status: '待确认', dueDate: '', description: '' };

export function IssueWorkspace({ rows = [], suppliers = [], products = [], onChange, onCreate, today }) {
  const [issues, setIssues] = useState(() => rows.map((row) => createIssue(row, { id: row.issueId })));
  const [filters, setFilters] = useState({ query: '', supplierId: '', status: '', priority: '', type: '', overdue: false });
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [customField, setCustomField] = useState({ key: '', value: '' });

  const visibleIssues = useMemo(() => filterIssues(issues, { ...filters, overdue: filters.overdue ? true : undefined, today }), [issues, filters, today]);
  const summary = useMemo(() => getIssueSummary(issues, today), [issues, today]);
  const supplierMap = useMemo(() => new Map(suppliers.map((supplier) => [supplier.supplierId, supplier.supplierName ?? supplier.supplierId])), [suppliers]);
  const productMap = useMemo(() => new Map(products.map((product) => [product.productId, product.productName ?? product.productId])), [products]);

  function commit(next) {
    setIssues(next);
    onChange?.(next);
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.title.trim()) return;
    const issue = createIssue({ ...draft, customFields: customField.key ? { [customField.key]: customField.value } : {} });
    const next = [...issues, issue];
    commit(next);
    onCreate?.(issue);
    setDraft(emptyDraft);
    setCustomField({ key: '', value: '' });
    setShowForm(false);
  }

  function edit(issueId, patch) {
    commit(updateIssue(issues, issueId, patch));
  }

  function changeStatus(issueId, status) {
    commit(transitionIssue(issues, issueId, status));
  }

  return (
    <section className="issues-workspace" aria-label="供应商问题台账">
      <header className="issues-workspace__header">
        <div>
          <p className="issues-workspace__eyebrow">运营协作</p>
          <h2>供应商问题台账</h2>
          <p className="issues-workspace__intro">记录问题、明确下一步动作，并持续追踪供应商响应。</p>
        </div>
        <button type="button" className="issues-workspace__primary" onClick={() => setShowForm((value) => !value)}>{showForm ? '收起表单' : '新增问题'}</button>
      </header>

      <div className="issues-workspace__summary" aria-label="问题概览">
        <div><span>全部问题</span><strong>{summary.total}</strong></div>
        <div><span>未解决</span><strong>{summary.open}</strong></div>
        <div className={summary.overdue ? 'is-warning' : ''}><span>已逾期</span><strong>{summary.overdue}</strong></div>
        <div><span>高优先级</span><strong>{summary.highPriority}</strong></div>
      </div>

      {showForm && (
        <form className="issues-workspace__form" onSubmit={submit}>
          <div className="issues-workspace__form-grid">
            <label>问题标题<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：补货时间未确认" required /></label>
            <label>供应商<select value={draft.supplierId} onChange={(event) => setDraft({ ...draft, supplierId: event.target.value })}><option value="">请选择</option>{suppliers.map((supplier) => <option value={supplier.supplierId} key={supplier.supplierId}>{supplier.supplierName ?? supplier.supplierId}</option>)}</select></label>
            <label>关联商品<select value={draft.productId} onChange={(event) => setDraft({ ...draft, productId: event.target.value })}><option value="">不关联</option>{products.map((product) => <option value={product.productId} key={product.productId}>{product.productName ?? product.productId}</option>)}</select></label>
            <label>问题类型<select value={draft.type} onChange={(event) => setDraft({ ...draft, type: event.target.value })}>{ISSUE_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>优先级<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>{ISSUE_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label>截止日期<input type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
          </div>
          <label>问题描述<textarea rows="2" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="补充背景、影响和需要确认的信息" /></label>
          <div className="issues-workspace__custom-fields"><input value={customField.key} onChange={(event) => setCustomField({ ...customField, key: event.target.value })} placeholder="自定义字段名（可选）" /><input value={customField.value} onChange={(event) => setCustomField({ ...customField, value: event.target.value })} placeholder="字段值" /><button type="submit" className="issues-workspace__primary">保存问题</button></div>
        </form>
      )}

      <div className="issues-workspace__filters">
        <input aria-label="搜索问题" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="搜索标题、描述、供应商或商品" />
        <select aria-label="筛选供应商" value={filters.supplierId} onChange={(event) => setFilters({ ...filters, supplierId: event.target.value })}><option value="">全部供应商</option>{suppliers.map((supplier) => <option value={supplier.supplierId} key={supplier.supplierId}>{supplier.supplierName ?? supplier.supplierId}</option>)}</select>
        <select aria-label="筛选状态" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">全部状态</option>{ISSUE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
        <select aria-label="筛选优先级" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">全部优先级</option>{ISSUE_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
        <label className="issues-workspace__check"><input type="checkbox" checked={filters.overdue} onChange={(event) => setFilters({ ...filters, overdue: event.target.checked })} />只看逾期</label>
      </div>

      <div className="issues-workspace__list">
        {visibleIssues.length === 0 ? <div className="issues-workspace__empty">暂无符合条件的问题</div> : visibleIssues.map((issue) => {
          const overdue = isOverdue(issue, today);
          return <article className={`issues-workspace__item ${overdue ? 'is-overdue' : ''}`} key={issue.issueId}>
            <div className="issues-workspace__item-main">
              <div className="issues-workspace__item-meta"><span>{issue.issueId}</span><span>{(supplierMap.get(issue.supplierId) ?? issue.supplierId) || '未指定供应商'}</span><span>{(productMap.get(issue.productId) ?? issue.productId) || '未关联商品'}</span></div>
              <input className="issues-workspace__title-input" aria-label={`${issue.issueId} 问题标题`} value={issue.title} onChange={(event) => edit(issue.issueId, { title: event.target.value })} />
              <textarea className="issues-workspace__description" aria-label={`${issue.issueId} 问题描述`} rows="2" value={issue.description} onChange={(event) => edit(issue.issueId, { description: event.target.value })} />
              {Object.keys(issue.customFields ?? {}).length > 0 && <div className="issues-workspace__custom-preview">{Object.entries(issue.customFields).map(([key, value]) => <span key={key}>{key}：{value}</span>)}</div>}
            </div>
            <div className="issues-workspace__item-controls">
              <select aria-label={`${issue.issueId} 状态`} value={issue.status} onChange={(event) => changeStatus(issue.issueId, event.target.value)}>{ISSUE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label={`${issue.issueId} 优先级`} value={issue.priority} onChange={(event) => edit(issue.issueId, { priority: event.target.value })}>{ISSUE_PRIORITIES.map((priority) => <option key={priority}>{priority}</option>)}</select>
              <label className="issues-workspace__date">截止<input type="date" value={issue.dueDate ?? ''} onChange={(event) => edit(issue.issueId, { dueDate: event.target.value })} /></label>
              {overdue && <span className="issues-workspace__overdue">已逾期</span>}
            </div>
          </article>;
        })}
      </div>
    </section>
  );
}

export default IssueWorkspace;
