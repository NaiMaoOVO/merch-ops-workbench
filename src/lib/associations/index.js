/**
 * Cross-module association helpers (PRD §8 阶段二闭环).
 * Diagnostics can become tasks or supplier issues; every record can be
 * linked to its analysis project so the dashboard can aggregate honestly.
 */

export const DIAGNOSTIC_STATUSES = Object.freeze(['待确认', '已确认', '已转任务', '已解决', '已复查']);

/** Attach project context immutably; unknown projects keep undefined linkage. */
export function linkRecord(record, projectId) {
  if (!record?.id) throw new Error('record.id is required');
  const id = projectId ? String(projectId) : undefined;
  return { ...record, projectId: id };
}

/** Move a diagnostic through the fixed lifecycle without skipping out of it. */
export function changeDiagnosticStatus(diagnostic, status, options = {}) {
  if (!DIAGNOSTIC_STATUSES.includes(status)) throw new Error(`未知的诊断状态：${status}`);
  const at = options.now ?? new Date().toISOString();
  return { ...diagnostic, status, statusUpdatedAt: at, ...(options.note ? { statusNote: String(options.note) } : {}) };
}

const PRIORITY_MAP = { 高: '高', 中: '中', 低: '低' };

/** Turn a confirmed diagnostic into a daily-task payload (PRD §8 确认策略). */
export function diagnosticToTaskPayload(diagnostic, options = {}) {
  if (!diagnostic?.id) throw new Error('diagnostic.id is required');
  return {
    id: options.id ?? `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: diagnostic.projectId ?? options.projectId,
    sourceDiagnosticId: diagnostic.id,
    title: `处理：${diagnostic.finding ?? '未命名诊断'}`,
    description: [options.hypothesisText, diagnostic.suggestedAction].filter(Boolean).join(' ') || '来自异常诊断卡片。',
    category: '策略诊断',
    priority: PRIORITY_MAP[diagnostic.priority] ?? '中',
    dueDate: options.dueDate ?? '',
    done: false,
    createdAt: options.now ?? new Date().toISOString(),
  };
}

/** Turn a supplier-related diagnostic into an issue ledger payload. */
export function diagnosticToIssuePayload(diagnostic, options = {}) {
  if (!diagnostic?.id) throw new Error('diagnostic.id is required');
  return {
    id: options.id ?? `issue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    projectId: diagnostic.projectId ?? options.projectId,
    sourceDiagnosticId: diagnostic.id,
    productId: diagnostic.productId ?? options.productId ?? '',
    supplierId: options.supplierId ?? '',
    title: `异常跟进：${diagnostic.finding ?? '未命名诊断'}`,
    description: diagnostic.suggestedAction ?? '来自异常诊断卡片。',
    priority: PRIORITY_MAP[diagnostic.priority] ?? '中',
    status: '待处理',
    createdAt: options.now ?? new Date().toISOString(),
  };
}

/** Aggregate records of one project by status for dashboards and reports. */
export function summariseByStatus(records, projectId) {
  const summary = {};
  let total = 0;
  for (const record of Array.isArray(records) ? records : []) {
    if (projectId && record?.projectId !== projectId) continue;
    const key = String(record?.status ?? '未设置');
    summary[key] = (summary[key] ?? 0) + 1;
    total += 1;
  }
  return { total, byStatus: summary };
}

/** 任务完成后，把由该诊断转出的条目自动标记为「已解决」。 */
export function applyTaskResolutions(diagnostics, tasks = []) {
  const list = Array.isArray(diagnostics) ? diagnostics : [];
  const resolvedSourceIds = new Set(
    (Array.isArray(tasks) ? tasks : [])
      .filter((task) => task?.status === '已完成' && task?.sourceDiagnosticId)
      .map((task) => String(task.sourceDiagnosticId)),
  );
  if (resolvedSourceIds.size === 0) return list;
  return list.map((item) => (
    resolvedSourceIds.has(String(item?.id)) && item?.status !== '已解决'
      ? { ...item, status: '已解决' }
      : item
  ));
}
