const textValue = (value, fallback = '') => (value === null || value === undefined ? fallback : String(value));

function normalizeHypothesis(value) {
  if (value && typeof value === 'object') {
    return { text: textValue(value.text, '待人工确认'), isAiAssisted: Boolean(value.isAiAssisted) };
  }
  return { text: textValue(value, '待人工确认'), isAiAssisted: Boolean(value) };
}

function normalizeDiagnostic(item = {}, index = 0) {
  const evidence = item.evidence && typeof item.evidence === 'object'
    ? textValue(item.evidence.text, JSON.stringify(item.evidence.values ?? item.evidence))
    : textValue(item.evidence, '待补充');
  return {
    id: textValue(item.id, `diagnostic-${index + 1}`),
    finding: textValue(item.finding, '未命名问题'),
    priority: textValue(item.priority, '未设置'),
    evidence,
    hypothesis: normalizeHypothesis(item.hypothesis),
    suggestedAction: textValue(item.suggestedAction, '待补充'),
  };
}

export function createReportDraft(report = {}) {
  const diagnostics = Array.isArray(report.diagnostics) ? report.diagnostics.map(normalizeDiagnostic) : [];
  const comparison = Array.isArray(report.comparison)
    ? report.comparison
      .filter((item) => item && typeof item.metric === 'string')
      .map((item) => ({ metric: item.metric, previous: Number(item.previous) || 0, current: Number(item.current) || 0, changeLabel: String(item.changeLabel ?? '—') }))
    : [];
  const annotations = report.annotations && typeof report.annotations === 'object' ? Object.entries(report.annotations).filter(([date, label]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && String(label).trim()).map(([date, label]) => ({ date, label: String(label).trim().slice(0, 40) })) : [];
  return {
    id: textValue(report.id, 'report-draft'),
    period: textValue(report.period, '未配置'),
    comparison,
    annotations,
    modules: [
      {
        id: 'overview',
        kind: 'text',
        title: '报告概览',
        visible: true,
        text: textValue(report.title, '商品经营分析报告'),
        period: textValue(report.period, '未配置'),
      },
      {
        id: 'diagnostics',
        kind: 'diagnostics',
        title: '策略诊断',
        visible: true,
        diagnostics,
      },
      {
        id: 'next-actions',
        kind: 'text',
        title: '下一步动作',
        visible: true,
        text: textValue(report.nextActions, '待补充'),
      },
    ],
  };
}

export function reorderReportModules(draft, orderedIds = []) {
  const modules = Array.isArray(draft?.modules) ? draft.modules : [];
  const byId = new Map(modules.map((module) => [module.id, module]));
  const requested = orderedIds.map((id) => byId.get(id)).filter(Boolean);
  const included = new Set(requested.map((module) => module.id));
  return { ...draft, modules: [...requested, ...modules.filter((module) => !included.has(module.id))] };
}

export function setReportModuleVisibility(draft, moduleId, visible) {
  return {
    ...draft,
    modules: (draft?.modules ?? []).map((module) => module.id === moduleId ? { ...module, visible: Boolean(visible) } : module),
  };
}

export function updateReportText(draft, moduleId, text) {
  return {
    ...draft,
    modules: (draft?.modules ?? []).map((module) => module.id === moduleId && module.kind === 'text' ? { ...module, text: textValue(text) } : module),
  };
}

function renderDiagnostic(item) {
  const hypothesisLabel = item.hypothesis.isAiAssisted ? 'AI 辅助假设（需人工验证）' : '辅助假设（需人工确认）';
  return [
    `### ${item.finding}（优先级：${item.priority}）`,
    `- 证据：${item.evidence}`,
    `- ${hypothesisLabel}：${item.hypothesis.text}`,
    `- 建议动作：${item.suggestedAction}`,
    '',
  ].join('\n');
}

export function renderReportMarkdown(draft = {}) {
  const lines = [];
  for (const module of draft.modules ?? []) {
    if (!module.visible) continue;
    if (module.id === 'overview') {
      lines.push(`# ${module.text || '商品经营分析报告'}`, '', `**周期**：${module.period || draft.period || '未配置'}`, '');
    } else if (module.id === 'diagnostics') {
      lines.push(`## ${module.title}`, '');
      if (!module.diagnostics?.length) lines.push('暂无已确认诊断。', '');
      for (const item of module.diagnostics ?? []) lines.push(renderDiagnostic(item));
    } else {
      lines.push(`## ${module.title}`, '', module.text || '待补充', '');
    }
  }
  const comparison = Array.isArray(draft.comparison) ? draft.comparison : [];
  if (comparison.length > 0) {
    lines.push('## 双周期对比', '', '| 指标 | 上期 | 本期 | 变化 |', '| --- | ---: | ---: | --- |');
    for (const item of comparison) {
      lines.push(`| ${item.metric} | ${item.previous.toLocaleString()} | ${item.current.toLocaleString()} | ${item.changeLabel} |`);
    }
    lines.push('');
  }
  const annotations = Array.isArray(draft.annotations) ? draft.annotations : [];
  if (annotations.length > 0) {
    lines.push('## 本期事件标注', '');
    for (const item of annotations) lines.push(`- ${item.date}：${item.label}`);
    lines.push('');
  }
  lines.push('> 本报告由本地规则分析生成；AI 辅助假设需要人工验证。');
  return lines.join('\n').trimEnd();
}

export function downloadMarkdownReport(markdown, filename = '商品经营分析报告.md') {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return false;
  const blob = new Blob([textValue(markdown)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.md') ? filename : `${filename}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

/* ==================== 报告模板库 ==================== */

export const REPORT_TEMPLATES_KEY = 'merch-workbench:report-templates';
export const REPORT_TEMPLATES_LIMIT = 30;

function templateStorage(storage = typeof window !== 'undefined' ? window.localStorage : null) { return storage; }

/** 读取已保存的报告模板（自动过滤坏条目）。 */
export function loadReportTemplates(storage = templateStorage()) {
  try {
    const parsed = JSON.parse(storage?.getItem(REPORT_TEMPLATES_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.name === 'string' && Array.isArray(item.modules));
  } catch {
    return [];
  }
}

/** 保存模板列表（超出上限淘汰最旧），返回实际写入条数。 */
export function saveReportTemplates(storage, templates) {
  const store = templateStorage(storage);
  const list = (Array.isArray(templates) ? templates : []).slice(-REPORT_TEMPLATES_LIMIT);
  store?.setItem(REPORT_TEMPLATES_KEY, JSON.stringify(list));
  return list.length;
}

/** 由名称与当前模块结构构造模板对象。 */
export function buildReportTemplate(name, modules) {
  if (!name || !Array.isArray(modules) || modules.length === 0) throw new Error('模板名称与模块结构不能为空');
  return { id: 'tpl-' + Date.now(), name: String(name), savedAt: new Date().toISOString(), modules: JSON.parse(JSON.stringify(modules)) };
}

