const storageKey = (id) => `merch-workbench:project:${id}`;

export function saveProject(project, storage = globalThis.localStorage) {
  if (!project?.id) throw new Error('project.id is required');
  storage.setItem(storageKey(project.id), JSON.stringify(project));
  return project;
}

export function loadProject(id, storage = globalThis.localStorage) {
  if (!id) return null;
  const raw = storage.getItem(storageKey(id));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function buildMarkdownReport(report = {}) {
  const lines = [`# ${report.title ?? '商品经营分析报告'}`, '', `**周期**：${report.period ?? '未配置'}`, '', '## 策略诊断', ''];
  const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics : [];
  if (!diagnostics.length) lines.push('暂无已确认诊断。');
  for (const item of diagnostics) {
    lines.push(`### ${item.finding ?? '未命名问题'}（优先级：${item.priority ?? '未设置'}）`);
    lines.push(`- 证据：${item.evidence ?? '待补充'}`);
    lines.push(`- 辅助假设：${item.hypothesis ?? '待人工确认'}`);
    lines.push('');
  }
  lines.push('> 本报告由本地规则分析生成；辅助假设需要人工验证。');
  return lines.join('\n');
}
