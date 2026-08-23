import test from 'node:test';
import assert from 'node:assert/strict';

import { applyManualMapping, applyMappingToRows, buildMappingTemplate, validateFieldMapping } from '../src/lib/data/index.js';

test('manual mapping sets, overrides and clears targets immutably', () => {
  const first = applyManualMapping({}, 'productId', '商品ID');
  assert.deepEqual(first, { productId: '商品ID' });
  const second = applyManualMapping(first, 'productId', '货号');
  assert.equal(second.productId, '货号');
  const cleared = applyManualMapping(second, 'productId', '');
  assert.deepEqual(cleared, {});
  assert.equal(first.productId, '商品ID'); // original untouched
});

test('validation reports missing required fields and duplicated sources as errors', () => {
  const result = validateFieldMapping({ productId: 'A', salesAmount: 'A', category: 'B' }, { requiredTargets: ['productId', 'salesAmount', 'date'] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === 'missing-required' && item.target === 'date'));
  assert.ok(result.errors.some((item) => item.code === 'duplicate-source' && item.source === 'A'));
});

test('validation flags low-confidence suggestions that were not confirmed manually', () => {
  const result = validateFieldMapping({ productId: '商品ID' }, {
    requiredTargets: ['productId'],
    suggestions: [{ target: 'supplier', source: '商家名称', confidence: 0.72 }],
  });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((item) => item.code === 'low-confidence' && item.target === 'supplier'));
});

test('applyMappingToRows renames mapped columns and keeps unmapped ones', () => {
  const rows = applyMappingToRows([{ 商品ID: 'A', 备注: 'x' }], { productId: '商品ID' });
  assert.deepEqual(rows, [{ productId: 'A', 备注: 'x' }]);
});

test('mapping templates require a name and carry scope metadata', () => {
  const template = buildMappingTemplate('US 周报映射', { productId: '商品ID' }, { site: 'US' });
  assert.equal(template.type, 'field-mapping');
  assert.equal(template.site, 'US');
  assert.match(template.id, /^tpl-/);
  assert.throws(() => buildMappingTemplate('  ', {}), /模板名称/);
});
