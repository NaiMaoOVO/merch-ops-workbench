import { IDBFactory } from 'fake-indexeddb';
import { openDatabase } from '../src/lib/storage/idb.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageFacade } from '../src/lib/storage/facade.js';
import { collectLocalStorageEntries, migrateLocalStorageToIdb } from '../src/lib/storage/migrator.js';

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

test('迁移器：仅拷贝工作台命名空间并写水位，二次执行跳过', async () => {
  const storage = createMemoryStorage({
    'merch-workbench:tasks': '[1,2]',
    'merch-workbench:project:p1': '{"id":"p1"}',
    'other-app:key': 'skip-me',
  });
  const db = await openDatabase({ indexedDBFactory: new IDBFactory(), dbName: 'mig-test' });
  const first = await migrateLocalStorageToIdb({ db, localStorageImpl: storage });
  assert.equal(first.skipped, false);
  assert.equal(first.copied, 2);
  const second = await migrateLocalStorageToIdb({ db, localStorageImpl: storage });
  assert.equal(second.skipped, true);
});

test('门面启动即迁移，小值双写镜像、大值不镜像', async () => {
  const bigValue = 'x'.repeat(9000);
  const storage = createMemoryStorage({ 'merch-workbench:legacy': 'old' });
  const facade = createStorageFacade({ indexedDBFactory: new IDBFactory(), localStorageImpl: storage });
  await facade.set('merch-workbench:small', 'ok');
  await facade.set('merch-workbench:big', bigValue);
  assert.equal(await facade.get('merch-workbench:legacy'), 'old');
  assert.equal(storage.getItem('merch-workbench:small'), 'ok');
  assert.equal(storage.getItem('merch-workbench:big'), null);
  assert.equal(await facade.get('merch-workbench:big'), bigValue);
});

test('collectLocalStorageEntries 排序且过滤外部键', () => {
  const storage = createMemoryStorage({ 'b:x': '2', 'a:y': '1' });
  const entries = collectLocalStorageEntries(storage, 'a');
  assert.deepEqual(entries, [{ key: 'a:y', value: '1' }]);
});
