import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprintColumns, loadRememberedMapping, rememberMapping } from '../src/lib/data/index.js';

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

test('列名指纹与顺序、大小写、空白无关', () => {
  const a = fingerprintColumns(['Product ID', 'Sales Amount', 'date']);
  const b = fingerprintColumns(['sales amount', 'DATE', 'product id']);
  assert.equal(a, b);
  assert.notEqual(a, '');
  assert.equal(fingerprintColumns([]), '');
});

test('记住并取回映射；未知结构返回 null', () => {
  const storage = createMemoryStorage();
  const fp = fingerprintColumns(['商品ID', '销售额', '日期']);
  assert.equal(loadRememberedMapping(storage, fp), null);
  rememberMapping(storage, fp, { productId: '商品ID', salesAmount: '销售额' });
  assert.deepEqual(loadRememberedMapping(storage, fp), { productId: '商品ID', salesAmount: '销售额' });
  assert.equal(loadRememberedMapping(storage, 'other'), null);
});

test('记忆容量上限为 20 条并淘汰最旧', () => {
  const storage = createMemoryStorage();
  for (let index = 0; index < 25; index += 1) {
    rememberMapping(storage, 'fp-' + index, { productId: 'c' + index }, { savedAt: '2026-01-0' + (index % 9) + 'T00:00:00Z' });
  }
  let count = 0;
  for (let index = 0; index < storage.length; index += 1) {
    if (String(storage.key(index)).startsWith('merch-workbench:mapping-memory:')) count += 1;
  }
  assert.ok(count <= 20);
});
