import { createStorageFacade } from './facade.js';

const PREFIX = 'merch-workbench:';

/**
 * 混合存储：内存缓存 + IndexedDB 持久化。
 * - 形状与 Storage 一致（getItem/setItem/removeItem/key/length），可整体替换 window.localStorage；
 * - hydrate() 在首次渲染前把 IDB 里的既有数据灌入缓存；
 * - 写入即时更新缓存并异步落盘（facade 内含 localStorage 降级）。
 */
export function createHybridStorage({ facade = createStorageFacade(), prefix = PREFIX } = {}) {
  const cache = new Map();
  let ready = false;
  let readyPromise = null;

  function hydrate() {
    if (ready) return Promise.resolve();
    if (!readyPromise) {
      readyPromise = (async () => {
        try {
          const keys = await facade.keys(prefix);
          await Promise.all(keys.map(async (key) => {
            const value = await facade.get(key);
            if (value != null) cache.set(key, value);
          }));
        } catch { /* 空启动：无历史数据也可正常运行 */ }
        ready = true;
      })();
    }
    return readyPromise;
  }

  function snapshotKeys() { return [...cache.keys()].filter((key) => key.startsWith(prefix)).sort(); }

  return {
    hydrate,
    facade,
    getItem: (key) => (cache.has(key) ? cache.get(key) : null),
    setItem: (key, value) => { cache.set(key, String(value)); void facade.set(key, String(value)); },
    removeItem: (key) => { cache.delete(key); void facade.remove(key); },
    clear: () => { snapshotKeys().forEach((key) => { cache.delete(key); void facade.remove(key); }); },
    key: (index) => snapshotKeys()[index] ?? null,
    get length() { return snapshotKeys().length; },
  };
}
