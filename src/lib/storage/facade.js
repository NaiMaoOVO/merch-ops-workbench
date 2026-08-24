import { idbAllKeys, idbDelete, idbGet, idbSet, openDatabase } from './idb.js';

/**
 * 异步存储门面：优先 IndexedDB，任何失败回退 localStorage，保证功能不缩水。
 * 接口与原同步 localStorage 语义对齐：get→string|null、set、remove、keys(prefix)。
 */
export function createStorageFacade({ indexedDBFactory = globalThis.indexedDB, localStorageImpl = globalThis.localStorage } = {}) {
  let dbPromise = null;
  function getDb() {
    if (!dbPromise) dbPromise = openDatabase({ indexedDBFactory });
    return dbPromise;
  }
  async function get(key) {
    try {
      const db = await getDb();
      const record = await idbGet(db, 'kv', key);
      return record ? String(record.value) : null;
    } catch {
      return localStorageImpl?.getItem?.(key) ?? null;
    }
  }
  async function set(key, value) {
    try {
      const db = await getDb();
      await idbSet(db, 'kv', key, String(value));
    } catch {
      localStorageImpl?.setItem?.(key, String(value));
    }
  }
  async function remove(key) {
    try {
      const db = await getDb();
      await idbDelete(db, 'kv', key);
    } catch {
      localStorageImpl?.removeItem?.(key);
    }
  }
  async function keys(prefix = '') {
    try {
      const db = await getDb();
      return await idbAllKeys(db, 'kv', prefix);
    } catch {
      const result = [];
      if (localStorageImpl) {
        for (let index = 0; index < localStorageImpl.length; index += 1) {
          const key = localStorageImpl.key(index);
          if (key && key.startsWith(prefix)) result.push(key);
        }
      }
      return result.sort();
    }
  }
  return { get, set, remove, keys };
}

export const storageFacade = createStorageFacade();
