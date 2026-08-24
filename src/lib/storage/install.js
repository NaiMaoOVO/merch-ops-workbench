import { createHybridStorage } from './hybrid.js';
import { purgeMigratedLocalStorageKeys } from './cleanup.js';

/** 影子化之前先抓住原生 localStorage 引用，供阶段D 安全清理使用。 */
const nativeLocalStorage = typeof window !== 'undefined' ? window.localStorage : null;

/**
 * 启动即接管 window.localStorage（影子属性，可配置回退），
 * 使全部既有同步调用点无感切换到「内存缓存 + IndexedDB」混合存储。
 * 必须作为 main.jsx 的首个 import，先于任何业务模块执行。
 */
export const workbenchStorage = createHybridStorage();

let installed = false;
try {
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => workbenchStorage,
    });
    installed = true;
  }
} catch { /* 个别环境禁止覆盖：保持原生 localStorage，功能不缩水 */ }

/** 等待既有数据灌入完成后渲染应用，避免首屏读到空数据。 */
export const ready = workbenchStorage.hydrate().then(async () => {
  try {
    await purgeMigratedLocalStorageKeys({
      facade: workbenchStorage.facade,
      nativeStorage: nativeLocalStorage,
      minAgeDays: 14,
    });
  } catch { /* 清理失败不影响任何功能，下次再试 */ }
  return { installed };
});
