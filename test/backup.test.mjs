import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBackup, collectBackup, summariseBackup, validateBackup } from '../src/lib/projects/backup.js';

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

test('collectBackup 仅捕获工作台命名空间并按键排序', () => {
  const storage = createMemoryStorage({
    'merch-workbench:tasks': '[1]',
    'other-app:key': 'skip',
    'merch-workbench:project:p1': '{"id":"p1"}',
  });
  const snapshot = collectBackup(storage);
  assert.equal(snapshot.app, 'merch-workbench');
  assert.deepEqual(snapshot.entries.map((entry) => entry.key), [
    'merch-workbench:project:p1',
    'merch-workbench:tasks',
  ]);
});

test('validateBackup 拒绝外部应用与坏条目，applyBackup 覆盖写入', () => {
  assert.equal(validateBackup({ app: 'other' }).ok, false);
  assert.equal(validateBackup({ app: 'merch-workbench', entries: [{ key: 'evil:key', value: '1' }] }).ok, false);

  const storage = createMemoryStorage({ 'merch-workbench:tasks': '[]' });
  const payload = { app: 'merch-workbench', schemaVersion: 1, entries: [
    { key: 'merch-workbench:tasks', value: '[{"id":"t9"}]' },
    { key: 'merch-workbench:issues', value: '[]' },
  ] };
  const applied = applyBackup(payload, storage);
  assert.equal(applied, 2);
  assert.equal(storage.getItem('merch-workbench:tasks'), '[{"id":"t9"}]');
});

test('summariseBackup 按类别计数', () => {
  const summary = summariseBackup({ entries: [
    { key: 'merch-workbench:project:a' },
    { key: 'merch-workbench:report-draft:a' },
    { key: 'merch-workbench:tasks' },
    { key: 'merch-workbench:issues' },
    { key: 'merch-workbench:trends' },
    { key: 'merch-workbench:misc' },
  ] });
  assert.deepEqual(summary, { total: 6, project: 1, reportDraft: 1, task: 1, issue: 1, trend: 1, other: 1 });
});
