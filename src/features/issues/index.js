export const ISSUE_STATUSES = ['待确认', '处理中', '等待供应商', '已解决', '已关闭'];
export const ISSUE_PRIORITIES = ['高', '中', '低'];
export const ISSUE_TYPES = ['库存', '素材', '信息', '质量', '物流', '其他'];

const nowIso = () => new Date().toISOString();

export function createIssue(input = {}, options = {}) {
  const createdAt = options.createdAt ?? nowIso();
  return {
    issueId: options.id ?? input.issueId ?? `ISSUE-${Date.now()}`,
    supplierId: input.supplierId ?? '',
    productId: input.productId ?? '',
    title: input.title ?? '',
    type: input.type ?? '其他',
    priority: input.priority ?? '中',
    status: input.status ?? '待确认',
    dueDate: input.dueDate ?? '',
    description: input.description ?? '',
    resolution: input.resolution ?? '',
    owner: input.owner ?? '',
    attachments: Array.isArray(input.attachments) ? [...input.attachments] : [],
    customFields: { ...(input.customFields ?? {}) },
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  };
}

function assertStatus(status) {
  if (!ISSUE_STATUSES.includes(status)) throw new Error(`Unsupported issue status: ${status}`);
}

export function updateIssue(issues = [], issueId, patch = {}) {
  if (!issues.some((issue) => issue.issueId === issueId)) throw new Error(`Issue not found: ${issueId}`);
  return issues.map((issue) => issue.issueId !== issueId
    ? issue
    : {
      ...issue,
      ...patch,
      customFields: patch.customFields ? { ...(issue.customFields ?? {}), ...patch.customFields } : { ...(issue.customFields ?? {}) },
      attachments: patch.attachments ? [...patch.attachments] : issue.attachments,
      updatedAt: patch.updatedAt ?? nowIso(),
    });
}

export function transitionIssue(issues = [], issueId, status) {
  assertStatus(status);
  return updateIssue(issues, issueId, { status });
}

export function filterIssues(issues = [], filters = {}) {
  const query = String(filters.query ?? '').trim().toLowerCase();
  return issues.filter((issue) => {
    if (filters.supplierId && issue.supplierId !== filters.supplierId) return false;
    if (filters.productId && issue.productId !== filters.productId) return false;
    if (filters.status && issue.status !== filters.status) return false;
    if (filters.priority && issue.priority !== filters.priority) return false;
    if (filters.type && issue.type !== filters.type) return false;
    if (filters.overdue !== undefined && isOverdue(issue, filters.today) !== filters.overdue) return false;
    if (query) {
      const haystack = [issue.issueId, issue.title, issue.description, issue.supplierId, issue.productId, issue.type]
        .filter(Boolean).join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function isOverdue(issue, today = new Date().toISOString().slice(0, 10)) {
  if (!issue?.dueDate || ['已解决', '已关闭'].includes(issue.status)) return false;
  return String(issue.dueDate).slice(0, 10) < String(today).slice(0, 10);
}

export function getIssueSummary(issues = [], today) {
  return issues.reduce((summary, issue) => {
    summary.total += 1;
    if (['已解决', '已关闭'].includes(issue.status)) summary.resolved += 1;
    else summary.open += 1;
    if (isOverdue(issue, today)) summary.overdue += 1;
    if (issue.priority === '高' && !['已解决', '已关闭'].includes(issue.status)) summary.highPriority += 1;
    return summary;
  }, { total: 0, open: 0, overdue: 0, highPriority: 0, resolved: 0 });
}

export function mergeIssueRows(rows = []) {
  return rows.map((row) => createIssue(row, { id: row.issueId }));
}
