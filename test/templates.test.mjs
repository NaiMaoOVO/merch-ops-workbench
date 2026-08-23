import test from 'node:test';
import assert from 'node:assert/strict';

import {
  TEMPLATE_TYPES,
  createDefaultTemplates,
  createTemplate,
  copyTemplate,
  updateTemplate,
  deactivateTemplate,
  restoreDefaultTemplate,
  filterTemplatesByType,
  buildTemplateBackup,
  parseTemplateBackup,
  serialiseTemplateBackup,
} from '../src/features/templates/index.js';

test('creates a template with stable defaults and a generated id', () => {
  const template = createTemplate({ type: 'title-rule', name: '女装标题规则', config: { maxLength: 120 } }, { id: 't-1', now: '2026-08-22T08:00:00.000Z' });
  assert.equal(template.id, 't-1');
  assert.equal(template.type, 'title-rule');
  assert.equal(template.name, '女装标题规则');
  assert.equal(template.active, true);
  assert.equal(template.isDefault, false);
  assert.equal(template.createdAt, '2026-08-22T08:00:00.000Z');
  assert.deepEqual(template.config, { maxLength: 120 });
});

test('rejects unknown types and empty names', () => {
  assert.throws(() => createTemplate({ type: 'unknown', name: 'x' }), /Unsupported template type/);
  assert.throws(() => createTemplate({ type: 'report', name: ' ' }), /template.name is required/);
  assert.deepEqual(TEMPLATE_TYPES, ['field-mapping', 'anomaly-rule', 'title-rule', 'report']);
});

test('copies a template immutably and resets lifecycle fields', () => {
  const source = createTemplate({ id: 'source', type: 'report', name: '周报模板', active: false, isDefault: true, config: { sections: ['overview'] } }, { now: '2026-08-20' });
  const copy = copyTemplate(source, { id: 'copy', now: '2026-08-22' });
  assert.equal(copy.id, 'copy');
  assert.equal(copy.name, '周报模板（副本）');
  assert.equal(copy.active, true);
  assert.equal(copy.isDefault, false);
  assert.equal(copy.updatedAt, '2026-08-22');
  assert.notEqual(copy.config, source.config);
});

test('updates, deactivates, and restores a template without mutating the collection', () => {
  const templates = [
    createTemplate({ id: 'a', type: 'report', name: '报告', config: { title: 'A' } }, { now: '2026-08-20' }),
    createTemplate({ id: 'b', type: 'title-rule', name: '标题', config: {} }, { now: '2026-08-20' }),
  ];
  const updated = updateTemplate(templates, 'a', { name: '周报', config: { title: 'B' } }, { now: '2026-08-22' });
  assert.equal(updated[0].name, '周报');
  assert.deepEqual(updated[0].config, { title: 'B' });
  assert.equal(templates[0].name, '报告');

  const inactive = deactivateTemplate(updated, 'a', '2026-08-23');
  assert.equal(inactive[0].active, false);
  const restored = restoreDefaultTemplate(inactive, 'a', { now: '2026-08-24' });
  assert.equal(restored[0].active, true);
  assert.equal(restored[0].isDefault, true);
});

test('restores the matching built-in default configuration when defaultKey is provided', () => {
  const defaults = createDefaultTemplates({ now: '2026-08-01', idFactory: (key) => `default-${key}` });
  const custom = createTemplate({ id: 'custom', type: 'anomaly-rule', name: '自定义规则', defaultKey: 'anomaly-basic', config: { threshold: 0.1 } }, { now: '2026-08-20' });
  const restored = restoreDefaultTemplate([custom], 'custom', { defaults, now: '2026-08-22' });
  assert.equal(restored[0].name, '基础异常规则');
  assert.deepEqual(restored[0].config, defaults.find((item) => item.defaultKey === 'anomaly-basic').config);
  assert.equal(restored[0].isDefault, true);
});

test('filters active templates by type and supports all types', () => {
  const templates = createDefaultTemplates({ now: '2026-08-01', idFactory: (key) => `default-${key}` });
  const custom = createTemplate({ id: 'inactive', type: 'report', name: '旧报告', active: false }, { now: '2026-08-02' });
  assert.equal(filterTemplatesByType([...templates, custom], 'report').every((item) => item.type === 'report' && item.active), true);
  assert.equal(filterTemplatesByType([...templates, custom], 'all').length, templates.length);
  assert.equal(filterTemplatesByType(templates, 'bad').length, 0);
});

test('serialises and parses template backups', () => {
  const templates = createDefaultTemplates({ now: '2026-08-01', idFactory: (key) => `default-${key}` });
  const payload = buildTemplateBackup(templates, { exportedAt: '2026-08-22' });
  assert.equal(payload.type, 'merch-workbench-templates');
  assert.equal(payload.version, 1);
  assert.deepEqual(parseTemplateBackup(serialiseTemplateBackup(templates, { exportedAt: '2026-08-22' })), payload);
  assert.throws(() => parseTemplateBackup('{"foo":1}'), /格式不受支持/);
});
