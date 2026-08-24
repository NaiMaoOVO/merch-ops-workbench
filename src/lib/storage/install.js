import { createHybridStorage } from './hybrid.js';

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
export const ready = workbenchStorage.hydrate().then(() => ({ installed }));
