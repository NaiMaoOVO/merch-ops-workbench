import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createStorageFacade } from '../src/lib/storage/facade.js';

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

test('IndexedDB 门面：读写删与前缀枚举', async () => {
  const facade = createStorageFacade({ indexedDBFactory: new IDBFactory(), localStorageImpl: createMemoryStorage() });
  await facade.set('merch-workbench:project:a', '{"id":"a"}');
  await facade.set('merch-workbench:project:b', '{"id":"b"}');
  await facade.set('other:key', 'x');
  assert.equal(await facade.get('merch-workbench:project:a'), '{"id":"a"}');
  const keys = await facade.keys('merch-workbench:project:');
  assert.deepEqual(keys, ['merch-workbench:project:a', 'merch-workbench:project:b']);
  await facade.remove('merch-workbench:project:a');
  assert.equal(await facade.get('merch-workbench:project:a'), null);
});

test('IDB 不可用时回退 localStorage，语义一致', async () => {
  const fallback = createMemoryStorage();
  const facade = createStorageFacade({ indexedDBFactory: undefined, localStorageImpl: fallback });
  await facade.set('k1', 'v1');
  assert.equal(await facade.get('k1'), 'v1');
  assert.equal(fallback.getItem('k1'), 'v1');
  await facade.remove('k1');
  assert.equal(await facade.get('k1'), null);
  await facade.set('a2', 'x');
  await facade.set('a1', 'y');
  assert.deepEqual(await facade.keys('a'), ['a1', 'a2']);
});
