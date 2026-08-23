export const TEMPLATE_TYPES = Object.freeze(['field-mapping', 'anomaly-rule', 'title-rule', 'report']);

const TYPE_LABELS = Object.freeze({
  'field-mapping': '字段映射',
  'anomaly-rule': '异常规则',
  'title-rule': '标题规则',
  report: '报告模板',
});

const DEFAULT_DEFINITIONS = Object.freeze([
  { defaultKey: 'field-basic', type: 'field-mapping', name: '基础字段映射', description: '商品、流量和交易字段的常用映射。', config: { keyCandidates: ['商品 ID', '商品编码', '货号'], requiredFields: ['商品 ID'] } },
  { defaultKey: 'anomaly-basic', type: 'anomaly-rule', name: '基础异常规则', description: '识别高曝光低点击、低转化和销售下滑商品。', config: { exposurePercentile: 0.7, ctrPercentile: 0.35, conversionPercentile: 0.5 } },
  { defaultKey: 'title-basic', type: 'title-rule', name: '通用标题检查', description: '按语言、长度、禁用词和核心属性检查标题。', config: { minLength: 20, maxLength: 120, blockedWords: [], requiredAttributes: [] } },
  { defaultKey: 'report-weekly', type: 'report', name: '商品运营周报', description: '包含指标、诊断、策略和待跟进事项的周报结构。', config: { modules: ['overview', 'diagnostics', 'next-actions', 'supplier-issues'] } },
]);

function clone(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function resolveNow(options = {}) {
  return options.now ?? new Date().toISOString();
}

function resolveId(type, options = {}) {
  if (options.id) return options.id;
  if (options.idFactory) return options.idFactory(type);
  return `template-${type}-${Date.now()}`;
}

function assertType(type) {
  if (!TEMPLATE_TYPES.includes(type)) throw new Error(`Unsupported template type: ${type}`);
}

export function getTemplateTypeLabel(type) {
  return TYPE_LABELS[type] ?? type;
}

export function createTemplate(input = {}, options = {}) {
  const type = input.type ?? 'report';
  assertType(type);
  if (!String(input.name ?? '').trim()) throw new Error('template.name is required');
  const now = resolveNow(options);
  return {
    id: input.id ?? resolveId(type, options),
    type,
    name: String(input.name).trim(),
    description: input.description ?? '',
    config: clone(input.config ?? {}),
    defaultKey: input.defaultKey,
    isDefault: Boolean(input.isDefault),
    active: input.active !== false,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function createDefaultTemplates(options = {}) {
  return DEFAULT_DEFINITIONS.map((definition) => createTemplate({ ...definition, isDefault: true, active: true }, {
    now: options.now,
    id: options.idFactory ? options.idFactory(definition.defaultKey) : `default-${definition.defaultKey}`,
  }));
}

export function copyTemplate(template, options = {}) {
  if (!template?.id) throw new Error('template.id is required');
  const now = resolveNow(options);
  const copy = clone(template);
  return createTemplate({ ...copy, id: options.id, name: `${copy.name ?? copy.id}（副本）`, isDefault: false, active: true, createdAt: copy.createdAt ?? now }, { now, id: options.id, idFactory: options.idFactory });
}

export function updateTemplate(templates, id, patch = {}, options = {}) {
  if (!Array.isArray(templates)) throw new Error('templates must be an array');
  const now = resolveNow(options);
  return templates.map((template) => {
    if (template.id !== id) return clone(template);
    const next = { ...clone(template), ...clone(patch), id: template.id, updatedAt: now };
    assertType(next.type);
    if (!String(next.name ?? '').trim()) throw new Error('template.name is required');
    next.name = String(next.name).trim();
    return next;
  });
}

export function deactivateTemplate(templates, id, now = new Date().toISOString()) {
  return updateTemplate(templates, id, { active: false }, { now });
}

export function restoreDefaultTemplate(templates, id, options = {}) {
  if (!Array.isArray(templates)) throw new Error('templates must be an array');
  const defaults = options.defaults ?? createDefaultTemplates({ now: options.now });
  const target = templates.find((template) => template.id === id);
  if (!target) return templates.map(clone);
  const source = defaults.find((item) => (target.defaultKey && item.defaultKey === target.defaultKey) || item.type === target.type);
  if (!source) return templates.map(clone);
  const now = resolveNow(options);
  return templates.map((template) => template.id === id ? { ...clone(source), id: template.id, createdAt: template.createdAt ?? now, updatedAt: now } : clone(template));
}

export function filterTemplatesByType(templates = [], type = 'all', options = {}) {
  if (type !== 'all' && !TEMPLATE_TYPES.includes(type)) return [];
  return templates.filter((template) => (options.includeInactive || template.active !== false) && (type === 'all' || template.type === type)).map(clone);
}

export function buildTemplateBackup(templates = [], options = {}) {
  return { type: 'merch-workbench-templates', version: 1, exportedAt: options.exportedAt ?? new Date().toISOString(), templates: clone(templates) };
}

export function serialiseTemplateBackup(templates = [], options = {}) {
  return JSON.stringify(buildTemplateBackup(templates, options), null, 2);
}

export function parseTemplateBackup(serialised) {
  let payload;
  try { payload = typeof serialised === 'string' ? JSON.parse(serialised) : serialised; } catch { throw new Error('模板备份文件不是有效的 JSON'); }
  if (payload?.type !== 'merch-workbench-templates' || payload.version !== 1 || !Array.isArray(payload.templates)) throw new Error('模板备份文件格式不受支持');
  return { ...clone(payload), templates: payload.templates.map((template) => createTemplate(template, { now: template.updatedAt, id: template.id })) };
}

export { DEFAULT_DEFINITIONS, TYPE_LABELS };
