import { idbAllKeys, idbSet } from './idb.js';

export const WORKBENCH_PREFIX = 'merch-workbench:';
export const MIGRATED_AT_KEY = 'migratedAt';

/** 收集 localStorage 中属于工作台命名空间的全部键值。 */
export function collectLocalStorageEntries(localStorageImpl, prefix = WORKBENCH_PREFIX) {
  const entries = [];
  if (!localStorageImpl) return entries;
  for (let index = 0; index < localStorageImpl.length; index += 1) {
    const key = localStorageImpl.key(index);
    if (!key || !key.startsWith(prefix)) continue;
    entries.push({ key, value: localStorageImpl.getItem(key) ?? '' });
  }
  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

/**
 * 一次性迁移：把 localStorage 的工作台数据拷入 IndexedDB，并写入迁移水位。
 * IDB 已有数据时跳过（除非 force），localStorage 原样保留作为回滚保险。
 */
export async function migrateLocalStorageToIdb({ db, localStorageImpl, prefix = WORKBENCH_PREFIX, force = false } = {}) {
  const existingKeys = await idbAllKeys(db, 'kv');
  if (existingKeys.length > 0 && !force) {
    return { skipped: true, copied: 0, reason: 'idb-not-empty' };
  }
  const entries = collectLocalStorageEntries(localStorageImpl, prefix);
  for (const entry of entries) {
    await idbSet(db, 'kv', entry.key, entry.value);
  }
  await idbSet(db, 'meta', MIGRATED_AT_KEY, new Date().toISOString());
  return { skipped: false, copied: entries.length };
}
