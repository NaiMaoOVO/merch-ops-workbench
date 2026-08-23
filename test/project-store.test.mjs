import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnalysisSnapshot,
  createAnalysisProject,
  estimateProjectBytes,
  findLatestAnalysisProject,
  formatBytes,
  loadAnalysisProject,
  migrateProject,
  removeAnalysisProject,
  saveAnalysisProject,
} from '../src/lib/projects/index.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
  };
}

const sheets = [
  { fileName: '销售.xlsx', name: '明细', headers: ['日期', '商品ID', '销售额'], rows: [{ 日期: '2026-08-24', 商品ID: 'A', 销售额: 20 }] },
];

test('builds a snapshot with sheet summaries and keeps data out of metadata', () => {
  const snapshot = buildAnalysisSnapshot({ importedFiles: sheets, fieldMapping: { productId: '商品ID' } });
  assert.equal(snapshot.sheets.length, 1);
  assert.deepEqual(snapshot.dataSources[0], { fileName: '销售.xlsx', sheetName: '明细', rowCount: 1, columnCount: 3 });
  assert.equal(snapshot.fieldMapping.productId, '商品ID');
});

test('save and load round-trips through storage and strips api keys', () => {
  const storage = memoryStorage();
  const project = createAnalysisProject({ name: '第 35 周', period: '8/25-8/31', snapshot: buildAnalysisSnapshot({ importedFiles: sheets, fieldMapping: {} }), apiKey: 'secret' });
  saveAnalysisProject(project, storage);
  const loaded = loadAnalysisProject(project.id, storage);
  assert.equal(loaded.name, '第 35 周');
  assert.equal(loaded.sheets[0].rows[0].商品ID, 'A');
  assert.equal(loaded.schemaVersion, 2);
  assert.equal(loaded.apiKey, undefined);
});

test('migrate upgrades v1 records and derives data sources', () => {
  const legacy = { id: 'old', name: '旧项目', schemaVersion: 1, sheets: [{ fileName: 'a.csv', name: 'S', headers: ['x'], rows: [{}] }] };
  const migrated = migrateProject(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.dataSources[0].rowCount, 1);
});

test('remove clears project and optionally its report draft', () => {
  const storage = memoryStorage();
  const project = createAnalysisProject({ id: 'p-remove', name: '待删除' });
  saveAnalysisProject(project, storage);
  storage.setItem('merch-workbench:report-draft:p-remove', '{}');
  const result = removeAnalysisProject(project.id, storage, { includeReportDrafts: true });
  assert.equal(result.removedProject, true);
  assert.equal(result.removedDrafts, 1);
  assert.equal(loadAnalysisProject(project.id, storage), null);
});

test('estimate and format project size for storage management', () => {
  const project = createAnalysisProject({ name: '大小检查' });
  const bytes = estimateProjectBytes(project);
  assert.ok(bytes > 0);
  assert.ok(formatBytes(bytes).length > 0);
  assert.equal(formatBytes(2048), '2 KB');
});

test('findLatestAnalysisProject resumes the newest project that still has data', () => {
  const storage = memoryStorage();
  assert.equal(findLatestAnalysisProject(storage), null);
  saveAnalysisProject(createAnalysisProject({ id: 'old-data', name: '旧', createdAt: '2026-08-20T00:00:00.000Z', updatedAt: '2026-08-20T00:00:00.000Z', snapshot: buildAnalysisSnapshot({ importedFiles: sheets }) }), storage);
  saveAnalysisProject(createAnalysisProject({ id: 'new-empty', name: '空项目', updatedAt: '2026-08-26T00:00:00.000Z' }), storage);
  const latest = findLatestAnalysisProject(storage);
  assert.equal(latest.id, 'old-data'); // 空项目不参与恢复
});
