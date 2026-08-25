#!/usr/bin/env node
/** 打包便携版：release/index.html（单文件）+ 启动器 + 使用说明 + 可选 Node 安装包 → 一键使用包 zip。
 *  用法：WITH_NODE=0 npm run pack:portable 可跳过 Node 安装包下载（离线/快速打包）。 */
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

const NODE_VERSION = 'v22.14.0';
const NODE_DIST = `https://nodejs.org/dist/${NODE_VERSION}`;
const NODE_INSTALLERS = [
  { file: `node-${NODE_VERSION}.pkg`, label: 'Node安装包-macOS.pkg' },
  { file: `node-${NODE_VERSION}-x64.msi`, label: 'Node安装包-Windows-64位.msi' },
];
const cacheDir = path.join(releaseDir, 'node-cache');
fs.mkdirSync(cacheDir, { recursive: true });

async function ensureNodeInstaller(entry) {
  const cached = path.join(cacheDir, entry.file);
  if (fs.existsSync(cached) && fs.statSync(cached).size > 1024 * 1024) return cached;
  const url = `${NODE_DIST}/${entry.file}`;
  process.stdout.write(`下载 ${url} …\n`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length < 1024 * 1024) throw new Error('文件过小，疑似损坏');
  fs.writeFileSync(cached, buffer);
  return cached;
}

const packName = '海外商品运营工作台-一键使用包';
const packDir = path.join(releaseDir, packName);
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

let withNode = process.env.WITH_NODE !== '0';
if (withNode) {
  try {
    const nodeDir = path.join(packDir, 'Node安装包-可选');
    fs.mkdirSync(nodeDir, { recursive: true });
    for (const entry of NODE_INSTALLERS) {
      const cached = await ensureNodeInstaller(entry);
      fs.copyFileSync(cached, path.join(nodeDir, entry.label));
    }
    fs.writeFileSync(path.join(nodeDir, '什么时候需要装Node.txt'), [
      '【什么时候需要安装 Node.js？】',
      '',
      '绝大多数情况：不需要。双击「工作台.html」即可使用，与 Node 无关。',
      '',
      '只有当对方想运行源码版本（npm run dev）或使用开发功能时才需要：',
      '- macOS：双击 .pkg（通用版，Apple 芯片和 Intel 芯片都支持）',
      '- Windows 64 位：选 .msi',
      '',
      `安装包来源：${NODE_DIST}（Node.js 官方 LTS）`,
    ].join('\n'), 'utf8');
  } catch (error) {
    console.warn(`⚠️ Node 安装包下载失败（${error.message}），已跳过；可用 WITH_NODE=0 显式关闭重试。`);
    fs.rmSync(path.join(packDir, 'Node安装包-可选'), { recursive: true, force: true });
    withNode = false;
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
    withNode ? '包内「Node安装包-可选」文件夹：仅当想运行源码版本时才需要安装，日常使用完全不需要。' : '',
    '提示：本包为纯前端单文件应用，日常使用无需安装 Node 或任何依赖。',
  ].filter(Boolean).join('\n'),
  'utf8',
);

const zipPath = path.join(releaseDir, packName + '.zip');
fs.rmSync(zipPath, { force: true });
execSync(`cd release && ditto -c -k --sequesterRsrc --keepParent "${packName}" "${packName}.zip"`, { stdio: 'inherit' });
console.log('✅ 便携包已生成：release/' + packName + '.zip' + (withNode ? '（含 Node 安装包）' : ''));
