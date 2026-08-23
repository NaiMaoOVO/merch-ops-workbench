export const PROVIDER_PRESETS = Object.freeze({
  deepseek: Object.freeze({ label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }),
  openai: Object.freeze({ label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' }),
  custom: Object.freeze({ label: '自定义兼容接口', baseUrl: '', model: '' }),
});

const API_KEY_PATTERN = /api[_-]?key/i;

export function normalizeAiConfig(input = {}) {
  const provider = Object.hasOwn(PROVIDER_PRESETS, input.provider) ? input.provider : 'deepseek';
  const preset = PROVIDER_PRESETS[provider];
  return {
    provider,
    baseUrl: String(input.baseUrl ?? preset.baseUrl),
    model: String(input.model ?? preset.model),
    apiKey: String(input.apiKey ?? ''),
  };
}

export function validateAiConfig(input = {}) {
  const config = normalizeAiConfig(input);
  const errors = [];
  if (!/^https?:\/\/[^\s]+$/i.test(config.baseUrl)) errors.push('接口地址必须是有效的 http(s) 地址');
  if (!config.model.trim()) errors.push('模型名称不能为空');
  if (!config.apiKey.trim()) errors.push('API Key 不能为空');
  return { valid: errors.length === 0, errors };
}

export function toggleSensitiveField(fields = [], field, enabled) {
  const next = fields.filter((item) => item !== field);
  if (enabled) next.push(field);
  return next;
}

export function maskSensitiveValue(value) {
  const text = String(value ?? '');
  if (!text) return '';
  if (text.length <= 2) return '*'.repeat(text.length);
  return `${text[0]}${'*'.repeat(text.length - 2)}${text.at(-1)}`;
}

export function sanitizeSettingsForExport(value) {
  if (Array.isArray(value)) return value.map(sanitizeSettingsForExport);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !API_KEY_PATTERN.test(key))
    .map(([key, item]) => [key, sanitizeSettingsForExport(item)]));
}

const CLEAR_TARGETS = [
  ['projects', '历史项目'],
  ['issues', '供应商问题'],
  ['tasks', '日常任务'],
  ['templates', '模板与规则'],
];

export function buildClearDataTargets(snapshot = {}) {
  return CLEAR_TARGETS.map(([id, label]) => ({
    id,
    label,
    count: Array.isArray(snapshot[id]) ? snapshot[id].length : 0,
    selected: false,
  }));
}

export function normalizeVisualSettings(input = {}) {
  return {
    focusMode: Boolean(input.focusMode),
    reduceMotion: Boolean(input.reduceMotion),
  };
}
