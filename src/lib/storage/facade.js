import { idbAllKeys, idbDelete, idbGet, idbSet, openDatabase } from './idb.js';
import { migrateLocalStorageToIdb } from './migrator.js';

const MIRROR_MAX_LENGTH = 8192;

/**
 * 异步存储门面：优先 IndexedDB，任何失败回退 localStorage，保证功能不缩水。
 * 接口与原同步 localStorage 语义对齐：get→string|null、set、remove、keys(prefix)。
 */
export function createStorageFacade({ indexedDBFactory = globalThis.indexedDB, localStorageImpl = globalThis.localStorage } = {}) {
  let dbPromise = null;
  let migrationStarted = false;
  function getDb() {
    if (!dbPromise) dbPromise = openDatabase({ indexedDBFactory });
    return dbPromise;
  }
  async function ensureMigrated() {
    if (migrationStarted || !localStorageImpl || !indexedDBFactory) return;
    migrationStarted = true;
    try {
      const db = await getDb();
      await migrateLocalStorageToIdb({ db, localStorageImpl });
    } catch { /* 迁移失败不阻塞读写，走降级路径 */ }
  }
  function mirrorToLocalStorage(key, value) {
    try {
      if (String(value).length <= MIRROR_MAX_LENGTH && key.startsWith('merch-workbench:')) {
        localStorageImpl?.setItem?.(key, String(value));
      }
    } catch { /* 镜像失败不影响主路径 */ }
  }
  async function get(key) {
    await ensureMigrated();
    try {
      const db = await getDb();
      const record = await idbGet(db, 'kv', key);
      return record ? String(record.value) : null;
    } catch {
      return localStorageImpl?.getItem?.(key) ?? null;
    }
  }
  async function set(key, value) {
    await ensureMigrated();
    try {
      const db = await getDb();
      await idbSet(db, 'kv', key, String(value));
      mirrorToLocalStorage(key, value);
    } catch {
      localStorageImpl?.setItem?.(key, String(value));
    }
  }
  async function remove(key) {
    await ensureMigrated();
    try {
      const db = await getDb();
      await idbDelete(db, 'kv', key);
    } catch {
      localStorageImpl?.removeItem?.(key);
    }
    try { localStorageImpl?.removeItem?.(key); } catch { /* 镜像清理尽力而为 */ }
  }
  async function keys(prefix = '') {
    await ensureMigrated();
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
  async function getMeta(key) {
    try {
      const db = await getDb();
      return await idbGet(db, 'meta', key);
    } catch {
      return null;
    }
  }
  async function setMeta(key, value) {
    try {
      const db = await getDb();
      await idbSet(db, 'meta', key, String(value));
    } catch { /* meta 写失败仅影响水位/统计 */ }
  }
  return { get, set, remove, keys, getMeta, setMeta };
}

export const storageFacade = createStorageFacade();
