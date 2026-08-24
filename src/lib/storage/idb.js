const DB_NAME = 'merch-workbench';
const DB_VERSION = 1;

export const STORES = { KV: 'kv', META: 'meta' };

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 请求失败'));
  });
}

function awaitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('事务中止'));
    tx.onerror = () => reject(tx.error ?? new Error('事务失败'));
  });
}

/** 打开（或创建）工作台数据库；库内含 kv 与 meta 两个 keyPath 型 store。 */
export function openDatabase({ indexedDBFactory = globalThis.indexedDB, dbName = DB_NAME, dbVersion = DB_VERSION } = {}) {
  return new Promise((resolve, reject) => {
    if (!indexedDBFactory || typeof indexedDBFactory.open !== 'function') {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const request = indexedDBFactory.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.KV)) db.createObjectStore(STORES.KV, { keyPath: 'key' });
      if (!db.objectStoreNames.contains(STORES.META)) db.createObjectStore(STORES.META, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 打开失败'));
  });
}

export async function idbGet(db, storeName, key) {
  const record = await promisify(db.transaction(storeName, 'readonly').objectStore(storeName).get(key));
  return record ?? null;
}

export async function idbSet(db, storeName, key, value) {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put({ key, value });
  await awaitTransaction(tx);
}

export async function idbDelete(db, storeName, key) {
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(key);
  await awaitTransaction(tx);
}

export async function idbAllKeys(db, storeName, prefix = '') {
  const keys = await promisify(db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys());
  return (keys ?? []).filter((key) => String(key).startsWith(prefix));
}
