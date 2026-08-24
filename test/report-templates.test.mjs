import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportTemplate, loadReportTemplates, REPORT_TEMPLATES_KEY, saveReportTemplates } from '../src/features/report/index.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

const modules = [{ id: 'overview', kind: 'text', title: '报告概览', visible: true, text: 'x' }];

test('模板保存与读取往返一致，坏条目被过滤', () => {
  const storage = createMemoryStorage();
  assert.deepEqual(loadReportTemplates(storage), []);
  const tpl = buildReportTemplate('周报结构', modules);
  saveReportTemplates(storage, [tpl, { bad: true }, null]);
  const loaded = loadReportTemplates(storage);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, '周报结构');
  assert.deepEqual(loaded[0].modules, modules);
});

test('模板数量上限 30 条，超出淘汰最旧', () => {
  const storage = createMemoryStorage();
  const list = Array.from({ length: 35 }, (_, index) => ({ id: 't' + index, name: 'm' + index, savedAt: String(index).padStart(3, '0'), modules }));
  const written = saveReportTemplates(storage, list);
  assert.equal(written, 30);
  const reloaded = loadReportTemplates(storage);
  assert.equal(reloaded.length, 30);
  assert.equal(reloaded[0].name, 'm5');
});
