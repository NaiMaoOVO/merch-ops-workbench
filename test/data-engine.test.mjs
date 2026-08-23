import test from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDataQuality,
  inferColumnType,
  matchTables,
  parseSpreadsheet,
  previewTable,
  suggestFieldMappings,
} from '../src/lib/data/index.js';

test('previewTable returns bounded rows and inferred column metadata', () => {
  const table = { headers: ['商品ID', '销量', '上架日期'], rows: [
    { 商品ID: 'A1', 销量: '12', 上架日期: '2026-08-01' },
    { 商品ID: 'A2', 销量: '8', 上架日期: '2026-08-02' },
  ] };
  const preview = previewTable(table, { limit: 1 });
  assert.equal(preview.rows.length, 1);
  assert.deepEqual(preview.columns.map((column) => column.type), ['string', 'number', 'date']);
});

test('inferColumnType detects booleans, numbers, dates, and strings', () => {
  assert.equal(inferColumnType(['1', '2.5', '']), 'number');
  assert.equal(inferColumnType(['true', 'false']), 'boolean');
  assert.equal(inferColumnType(['2026-08-01', '2026-08-02']), 'date');
  assert.equal(inferColumnType(['A1', 'A2']), 'string');
});

test('suggestFieldMappings scores aliases and leaves unknown fields unmapped', () => {
  const mappings = suggestFieldMappings(['商品ID', '销售额', '供应商'], ['productId', 'salesAmount', 'category']);
  assert.equal(mappings.find((mapping) => mapping.target === 'productId').source, '商品ID');
  assert.equal(mappings.find((mapping) => mapping.target === 'salesAmount').source, '销售额');
  assert.equal(mappings.find((mapping) => mapping.target === 'category').source, null);
});

test('suggestFieldMappings matches the same concept across Chinese and English headers', () => {
  const mappings = suggestFieldMappings(['productId', '供应商'], ['商品编号', 'supplier']);
  assert.equal(mappings[0].source, 'productId');
  assert.equal(mappings[1].source, '供应商');
});

test('matchTables reports unmatched rows, duplicate keys, empty keys, and expansion', () => {
  const result = matchTables(
    [{ id: 'A' }, { id: 'B' }, { id: '' }],
    [{ id: 'A', name: 'one' }, { id: 'A', name: 'two' }, { id: 'C', name: 'three' }, { id: '', name: 'blank' }],
    { primaryKey: 'id', secondaryKey: 'id' },
  );
  assert.equal(result.rows.length, 4);
  assert.deepEqual(result.report.unmatchedPrimaryKeys, ['B']);
  assert.deepEqual(result.report.unmatchedSecondaryKeys, ['C']);
  assert.deepEqual(result.report.duplicateSecondaryKeys, ['A']);
  assert.equal(result.report.emptyPrimaryKeyCount, 1);
  assert.equal(result.report.emptySecondaryKeyCount, 1);
  assert.equal(result.report.rowCountInflation, 1);
});

test('checkDataQuality reports structural and key issues without mutating rows', () => {
  const table = { headers: ['id', 'id', 'name', ''], rows: [
    { id: 'A', name: 'x', '': 'bad' },
    { id: 'A', name: '' },
  ] };
  const report = checkDataQuality(table, { key: 'id' });
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate_header'));
  assert.ok(report.issues.some((issue) => issue.code === 'empty_header'));
  assert.ok(report.issues.some((issue) => issue.code === 'duplicate_key'));
  assert.equal(report.rowCount, 2);
  assert.equal(table.rows.length, 2);
});

test('parseSpreadsheet reads CSV text without requiring a spreadsheet parser', async () => {
  const sheets = await parseSpreadsheet('商品ID,销量\nA1,12\nA2,8', { format: 'csv' });
  assert.equal(sheets.length, 1);
  assert.deepEqual(sheets[0].headers, ['商品ID', '销量']);
  assert.equal(sheets[0].rows[1].销量, '8');
});
