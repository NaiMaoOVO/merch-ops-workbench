import test from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { createHybridStorage } from '../src/lib/storage/hybrid.js';
import { createStorageFacade } from '../src/lib/storage/facade.js';

function makeFacade(seed = {}) {
  const backing = createStorageFacade({ indexedDBFactory: new IDBFactory() });
  return Promise.all(Object.entries(seed).map(([key, value]) => backing.set(key, value))).then(() => backing);
}

test('hydrate 灌入既有数据；写入即时可见并异步落盘', async () => {
  const facade = await makeFacade({ 'merch-workbench:tasks': '[1]' });
  const hybrid = createHybridStorage({ facade });
  assert.equal(hybrid.getItem('merch-workbench:tasks'), null, '水合前不可见');
  await hybrid.hydrate();
  assert.equal(hybrid.getItem('merch-workbench:tasks'), '[1]');
  assert.equal(hybrid.length, 1);
  hybrid.setItem('merch-workbench:issues', '[]');
  assert.equal(hybrid.getItem('merch-workbench:issues'), '[]');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(await facade.get('merch-workbench:issues'), '[]', '已异步落盘到 IDB');
});

test('key/length/removeItem/clear 遵循 Storage 形状且只暴露工作台命名空间', () => {
  const facade = createStorageFacade({ indexedDBFactory: new IDBFactory() });
  const hybrid = createHybridStorage({ facade });
  hybrid.setItem('merch-workbench:a', '1');
  hybrid.setItem('other:b', '2');
  assert.equal(hybrid.length, 1, '外部命名空间不计入');
  assert.deepEqual(hybrid.key(0), 'merch-workbench:a');
  hybrid.removeItem('merch-workbench:a');
  assert.equal(hybrid.getItem('merch-workbench:a'), null);
  hybrid.clear();
  assert.equal(hybrid.length, 0);
});
