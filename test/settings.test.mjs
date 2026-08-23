import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROVIDER_PRESETS,
  buildClearDataTargets,
  maskSensitiveValue,
  normalizeAiConfig,
  sanitizeSettingsForExport,
  toggleSensitiveField,
  validateAiConfig,
} from '../src/features/settings/index.js';

test('normalizes built-in and custom AI provider configurations locally', () => {
  assert.deepEqual(normalizeAiConfig({ provider: 'deepseek' }), {
    provider: 'deepseek',
    baseUrl: PROVIDER_PRESETS.deepseek.baseUrl,
    model: PROVIDER_PRESETS.deepseek.model,
    apiKey: '',
  });
  assert.deepEqual(normalizeAiConfig({ provider: 'custom', baseUrl: 'https://example.test/v1', model: 'my-model', apiKey: 'key' }), {
    provider: 'custom', baseUrl: 'https://example.test/v1', model: 'my-model', apiKey: 'key',
  });
});

test('validates provider configuration without making network requests', () => {
  assert.deepEqual(validateAiConfig({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-test' }), { valid: true, errors: [] });
  const result = validateAiConfig({ provider: 'custom', baseUrl: 'bad url', model: '', apiKey: '' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('接口地址必须是有效的 http(s) 地址'));
  assert.ok(result.errors.includes('模型名称不能为空'));
  assert.ok(result.errors.includes('API Key 不能为空'));
});

test('toggles sensitive fields and masks values for previews', () => {
  assert.deepEqual(toggleSensitiveField(['supplierName', 'price'], 'supplierName', false), ['price']);
  assert.deepEqual(toggleSensitiveField(['price'], 'supplierName', true), ['price', 'supplierName']);
  assert.equal(maskSensitiveValue('supplier-secret'), 's*************t');
  assert.equal(maskSensitiveValue('ab'), '**');
});

test('removes API keys recursively from exported settings', () => {
  const sanitized = sanitizeSettingsForExport({ ai: { apiKey: 'secret', model: 'gpt' }, apiKey: 'top', nested: [{ apiKey: 'nested', value: 1 }] });
  assert.deepEqual(sanitized, { ai: { model: 'gpt' }, nested: [{ value: 1 }] });
});

test('builds a clear-data target list without mutating or deleting data', () => {
  const snapshot = { projects: [{ id: 'p1' }], issues: [{ id: 'i1' }, { id: 'i2' }], tasks: [], templates: [{ id: 't1' }] };
  const targets = buildClearDataTargets(snapshot);
  assert.deepEqual(targets, [
    { id: 'projects', label: '历史项目', count: 1, selected: false },
    { id: 'issues', label: '供应商问题', count: 2, selected: false },
    { id: 'tasks', label: '日常任务', count: 0, selected: false },
    { id: 'templates', label: '模板与规则', count: 1, selected: false },
  ]);
  assert.equal(snapshot.issues.length, 2);
});
