import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 默认构建：dist/ 常规多文件产物（CI 使用）。
// BUILD_SINGLE=1 vite build：单文件便携版（双击 HTML 即可离线使用）。
const single = process.env.BUILD_SINGLE === '1';

export default defineConfig({
  base: './',
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  build: single
    ? {
        outDir: 'release',
        assetsInlineLimit: 100000000,
        chunkSizeWarningLimit: 100000000,
        cssCodeSplit: false,
        reportCompressedSize: false,
      }
    : {},
});
