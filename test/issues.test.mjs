import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createIssue,
  updateIssue,
  transitionIssue,
  filterIssues,
  isOverdue,
  getIssueSummary,
} from '../src/features/issues/index.js';

const base = {
  issueId: 'ISSUE-001',
  supplierId: 'SUP-02',
  productId: 'SKU-1002',
  title: '库存补充时间未确认',
  type: '库存',
  priority: '高',
  status: '等待供应商',
  dueDate: '2026-08-27',
  description: '确认补货时间',
  customFields: { channel: '群聊', ownerTeam: '商品运营' },
};

test('creates an issue with safe defaults while retaining custom fields', () => {
  const issue = createIssue({ title: '图片待补充', supplierId: 'SUP-04', customFields: { source: '邮件' } }, { id: 'ISSUE-NEW' });
  assert.equal(issue.issueId, 'ISSUE-NEW');
  assert.equal(issue.status, '待确认');
  assert.equal(issue.priority, '中');
  assert.deepEqual(issue.customFields, { source: '邮件' });
  assert.ok(issue.createdAt);
});

test('updates an issue immutably and preserves unspecified custom fields', () => {
  const issues = [base];
  const updated = updateIssue(issues, 'ISSUE-001', { description: '已联系供应商', customFields: { source: '邮件' } });
  assert.notEqual(updated, issues);
  assert.equal(issues[0].description, '确认补货时间');
  assert.equal(updated[0].description, '已联系供应商');
  assert.deepEqual(updated[0].customFields, { channel: '群聊', ownerTeam: '商品运营', source: '邮件' });
});

test('transitions only supported statuses', () => {
  const moved = transitionIssue([base], 'ISSUE-001', '处理中');
  assert.equal(moved[0].status, '处理中');
  assert.throws(() => transitionIssue([base], 'ISSUE-001', '未知状态'), /Unsupported issue status/);
});

test('filters by supplier, status, priority and free-text query', () => {
  const issues = [base, { ...base, issueId: 'ISSUE-002', supplierId: 'SUP-04', status: '处理中', priority: '中', title: '图片缺失' }];
  assert.deepEqual(filterIssues(issues, { supplierId: 'SUP-04' }).map((item) => item.issueId), ['ISSUE-002']);
  assert.deepEqual(filterIssues(issues, { status: '等待供应商' }).map((item) => item.issueId), ['ISSUE-001']);
  assert.deepEqual(filterIssues(issues, { priority: '高', query: '库存' }).map((item) => item.issueId), ['ISSUE-001']);
});

test('marks unresolved issues overdue only when due date is before today', () => {
  assert.equal(isOverdue({ ...base, dueDate: '2026-08-21' }, '2026-08-22'), true);
  assert.equal(isOverdue({ ...base, dueDate: '2026-08-22' }, '2026-08-22'), false);
  assert.equal(isOverdue({ ...base, dueDate: '2026-08-21', status: '已解决' }, '2026-08-22'), false);
  assert.equal(isOverdue({ ...base, dueDate: '' }, '2026-08-22'), false);
});

test('summarizes issue counts for the dashboard', () => {
  const issues = [base, { ...base, issueId: 'ISSUE-002', status: '处理中', priority: '高', dueDate: '2026-08-21' }, { ...base, issueId: 'ISSUE-003', status: '已解决' }];
  assert.deepEqual(getIssueSummary(issues, '2026-08-22'), { total: 3, open: 2, overdue: 1, highPriority: 2, resolved: 1 });
});
