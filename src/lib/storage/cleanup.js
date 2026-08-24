
const WORKBENCH_PREFIX = 'merch-workbench:';
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 阶段D 安全清理：迁移水位超过 minAgeDays 天后，
 * 仅删除「原生 localStorage 值与 IndexedDB 当前值完全一致」的旧键——
 * 内容不一致（说明迁移后又改过且未同步）的一律保留，宁可多占不可丢数据。
 */
export async function purgeMigratedLocalStorageKeys({ facade, nativeStorage, minAgeDays = 14, now = new Date() } = {}) {
  if (!facade || !nativeStorage) return { purged: 0, skipped: 'missing-deps' };
  let migratedAt = null;
  try {
    const record = await facade.getMeta('migratedAt');
    migratedAt = record ? (record.value ?? record) : null;
  } catch {
    return { purged: 0, skipped: 'meta-unreadable' };
  }
  const migratedAtMs = Date.parse(String(migratedAt ?? ''));
  if (!Number.isFinite(migratedAtMs)) return { purged: 0, skipped: 'no-watermark' };
  if (now.getTime() - migratedAtMs < minAgeDays * DAY_MS) {
    return { purged: 0, skipped: 'too-recent' };
  }
  let purged = 0;
  const keys = [];
  for (let index = 0; index < nativeStorage.length; index += 1) {
    const key = nativeStorage.key(index);
    if (key && key.startsWith(WORKBENCH_PREFIX)) keys.push(key);
  }
  for (const key of keys) {
    try {
      const localValue = nativeStorage.getItem(key);
      const idbValue = await facade.get(key);
      if (localValue != null && localValue === idbValue) {
        nativeStorage.removeItem(key);
        purged += 1;
      }
    } catch { /* 单键失败不影响其余清理 */ }
  }
  return { purged, skipped: null };
}