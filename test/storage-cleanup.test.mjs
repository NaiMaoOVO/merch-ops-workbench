import { IDBFactory } from 'fake-indexeddb';
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../src/lib/storage/idb.js';
import { purgeMigratedLocalStorageKeys } from '../src/lib/storage/cleanup.js';
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

async function makeFacadeWithWatermark(watermarkDate, idbSeed = {}) {
  const facade = createStorageFacade({ indexedDBFactory: new IDBFactory() });
  await facade.set('merch-workbench:tasks', '[1]');
  for (const [key, value] of Object.entries(idbSeed)) await facade.set(key, value);
  if (watermarkDate) await facade.setMeta('migratedAt', watermarkDate);
  return facade;
}

const NOW = new Date('2026-09-10T12:00:00');

test('水位过期且内容一致才清理；不一致保留', async () => {
  const native = createMemoryStorage({
    'merch-workbench:a': 'same',
    'merch-workbench:b': 'changed-after-migration',
  });
  const facade = await makeFacadeWithWatermark('2026-08-01T00:00:00', { 'merch-workbench:a': 'same', 'merch-workbench:b': 'new-idb-value' });
  await facade.set('merch-workbench:b', 'new-idb-value');
  const result = await purgeMigratedLocalStorageKeys({ facade, nativeStorage: native, minAgeDays: 14, now: NOW });
  assert.equal(result.purged, 1);
  assert.equal(native.getItem('merch-workbench:a'), null);
  assert.equal(native.getItem('merch-workbench:b'), 'changed-after-migration');
});

test('水位缺失或太新则完全不动', async () => {
  const freshNative = createMemoryStorage({ 'merch-workbench:a': 'x' });
  const freshFacade = await makeFacadeWithWatermark('2026-09-05T00:00:00');
  let result = await purgeMigratedLocalStorageKeys({ facade: freshFacade, nativeStorage: freshNative, minAgeDays: 14, now: NOW });
  assert.equal(result.skipped, 'too-recent');
  assert.equal(freshNative.getItem('merch-workbench:a'), 'x');

  const noMark = createMemoryStorage({ 'merch-workbench:a': 'x' });
  const noMarkFacade = await makeFacadeWithWatermark(null);
  result = await purgeMigratedLocalStorageKeys({ facade: noMarkFacade, nativeStorage: noMark, minAgeDays: 14, now: NOW });
  assert.equal(result.skipped, 'no-watermark');
  assert.equal(noMark.getItem('merch-workbench:a'), 'x');
});
