import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAnnotations, parseAnnotations, saveAnnotations, upsertAnnotation } from '../src/lib/storage/annotations.js';

test('标注解析过滤非法日期与空标签', () => {
  const map = parseAnnotations(JSON.stringify({ '2026-08-01': '大促', 'bad-date': 'x', '2026-08-02': '   ', nested: {} }));
  assert.deepEqual(map, { '2026-08-01': '大促' });
  assert.deepEqual(parseAnnotations('not-json'), {});
});

test('upsert 新增/更新/清空删除，save+load 往返一致', () => {
  const storage = { getItem: () => null, setItem: (k, v) => { storage._v = v; }, getItemBacked: null };
  let map = {};
  map = upsertAnnotation(map, '2026-08-10', '断货');
  map = upsertAnnotation(map, '2026-08-11', '竞品上线');
  map = upsertAnnotation(map, '2026-08-10', '');
  assert.deepEqual(map, { '2026-08-11': '竞品上线' });

  const store = createStorage();
  saveAnnotations(map, store);
  assert.deepEqual(loadAnnotations(store), map);
});

function createStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}
