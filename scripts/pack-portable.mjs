#!/usr/bin/env node
/** 打包便携版：release/index.html（单文件）+ 启动器 + 使用说明 → 一键使用包 zip。 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseDir = path.join(root, 'release');
const htmlPath = path.join(releaseDir, 'index.html');
if (!fs.existsSync(htmlPath)) {
  console.error('未找到 release/index.html，请先执行 BUILD_SINGLE=1 vite build');
  process.exit(1);
}

const packName = '海外商品运营工作台-一键使用包';
const packDir = path.join(root, 'release', packName);
fs.rmSync(packDir, { recursive: true, force: true });
fs.mkdirSync(packDir, { recursive: true });

fs.copyFileSync(htmlPath, path.join(packDir, '工作台.html'));
for (const launcher of ['启动工作台-Mac.command', '启动工作台-Windows.bat']) {
  const src = path.join(root, launcher);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(packDir, launcher));
    if (launcher.endsWith('.command')) fs.chmodSync(path.join(packDir, launcher), 0o755);
  }
}
fs.writeFileSync(
  path.join(packDir, '先看我-使用说明.txt'),
  [
    '【海外商品运营工作台 · 一键使用包】',
    '',
    '最快方式：直接双击「工作台.html」，用 Chrome/Edge 浏览器打开即可。',
    '- 数据只保存在你这台电脑的浏览器里，不上传任何服务器；',
    '- 建议把页面加入书签，方便每天打开；',
    '- 想清空数据：浏览器清除该页面的站点数据即可。',
    '',
    '如果双击 HTML 打不开或样式异常：',
    '- macOS：双击「启动工作台-Mac.command」（首次需在系统设置→隐私与安全里允许）；',
    '- Windows：双击「启动工作台-Windows.bat」；',
    '  这两个启动器会用一个本地小服务打开工作台，兼容性最好。',
    '',
    '提示：本包为纯前端单文件应用，无需安装 Node 或任何依赖。',
  ].join('\n'),
  'utf8',
);

const zipPath = path.join(releaseDir, packName + '.zip');
fs.rmSync(zipPath, { force: true });
execSync(`cd release && ditto -c -k --sequesterRsrc --keepParent "${packName}" "${packName}.zip"`, { stdio: 'inherit' });
console.log('✅ 便携包已生成：release/' + packName + '.zip');
