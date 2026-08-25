# 海外商品运营工作台

本地优先的海外商品运营辅助工作台（React + Vite，纯浏览器运行）。帮助跨境商品运营新人在不了解真实业务字段的情况下，完成一次**可解释、可复盘、可导出**的商品经营分析：导入 Excel/CSV → 字段识别与映射 → 多表匹配 → 数据质量检查 → 指标分析 → 异常诊断 → AI 辅助假设（可选，需人工确认）→ 周报导出。

> **隐私原则**：数据只存在你的浏览器 localStorage；原始文件只读；发送给 AI 前强制脱敏预览并手动放行；API Key 仅保存在本机设置里，不会进入备份或项目数据。

![工作台首页](public/workbench-home.png)


## 功能总览

- **商品数据分析**：多文件/多工作表导入（xlsx/xls/csv）、字段自动识别 + 手动映射校验、真实导入的多表匹配预览（关联键推荐）、质量检查、按商品+日期合并的流量/销售指标（点击率/转化率/客单价/环比）、异常商品一键下钻详情、可配置异常规则、品类透视与漏斗、Excel 导出。
- **日常效率**：趋势图 PNG 导出、周一周报提醒、首页指标卡显隐、⌘K/Ctrl+K 命令面板、日期事件标注、自动周备份、每日/每周/每月循环任务、深色模式和打印/PDF 样式。
- **周报智能辅助**：双周期对比表、AI 执行摘要（脱敏预览与人工确认后生成，结果标记待审核）、报告模板库。
- **标题优化**：本地模板生成 + 可选 AI 候选（脱敏预览后放行），长度/禁用词/事实一致性校验，勾选式批量人工审核，候选与原标题差异高亮，导出已通过项。
- **热点与选品 / 供应商问题 / 日常任务**：台账、状态流转、逾期计算、异常诊断一键转任务/问题。
- **周报与报告**：模块化编辑、撤销/重做、草稿按项目自动保存恢复、Markdown/HTML/Word/Excel/PDF 导出，导出前完整性检查（未确认 AI 假设、缺失周期、空模块提醒）。
- **历史项目**：项目快照持久化（含导入副本/映射/配置），复制/归档/删除、两两对比、备份导出导入（自动剥离 API Key）、本地占用统计。
- **模板中心 / 教程中心 / 设置**：JSON 模板、分级练习与快速引导、OpenAI 兼容接口配置与连通性测试。

## 快速开始

### 方式一：零安装一键使用（推荐给非技术用户）

1. 执行 `npm run pack:portable`，生成 `release/海外商品运营工作台-一键使用包.zip`；
2. 把压缩包发给朋友——对方解压后**双击 `工作台.html`** 即可在浏览器离线使用，无需安装 Node；
3. 数据只存在对方本机浏览器中。

### 方式二：源码运行

```bash
npm install
npm run dev      # 开发调试
npm test         # Node 内置测试运行器
npm run build    # 生产构建（dist/）
npm run check    # 测试 + 构建一起跑
```

要求 Node.js ≥ 18。无需任何账号或后端服务。

## 使用建议

1. 首次进入先在「教程与帮助」用示例数据走一遍完整流程。
2. 「商品数据分析」导入真实文件 → STEP 01 选表 → STEP 04 确认字段映射（可覆盖自动识别）→ 导入两张表时可在 STEP 03 配置主表/关联键并预览匹配。
3. 创建分析项目：数据副本、映射和配置会一起保存到本机，刷新或换页都能继续。
4. 「周报与报告」优先渲染当前项目的真实分析摘要；没有项目数据时会显示示例演示并明确标注。
5. 定期在「历史项目」导出备份 JSON；换电脑用「导入备份」恢复（冲突可另存为副本）。

## 架构速览

```text
src/
  App.jsx                  # 外壳、路由、驾驶舱、分析工作区
  lib/
    data/       # 解析、字段识别、匹配（matchTables / chainJoins）
    analysis/   # 聚合、异常、透视、指标/筛选/趋势/可配置规则
    projects/   # 项目快照持久化与迁移
    associations/# 诊断→任务/问题转换与状态机
    ai/         # OpenAI 兼容调用、脱敏、标题请求
    export/     # Markdown/HTML/Word/Excel/PDF 导出
  features/     # title / report / analysis / issues / tasks / trends / history / templates / settings / tutorial
```

## 开发约定

- 本地优先：不引入后端与云端数据库；所有网络请求仅限用户显式放行的 AI 调用。
- 分析口径必须可解释：每个比率在代码与报告中都保留公式来源；缺数据显示“尚未配置”，不伪造 0。
- 提交前运行 `npm run check`。

## 发布与同步（维护者）

```bash
# 首次上线：在 GitHub 建空仓库后
git remote add origin git@github.com:<user>/merch-ops-workbench.git
git push -u origin main        # CI 会自动运行 npm run check

# 日常同步
git add -A && git commit -m "feat: ..." && git push

# 发布一键使用包到 GitHub Releases（自动构建 + 上传附件）
git tag v0.1.0 && git push origin v0.1.0
```

打 `v*` 标签后，GitHub Actions 会自动：跑完整检查 → 构建单文件版 → 下载 Node.js 官方安装包并打包 → 把 zip 挂到 Releases 页。也可以在 Actions 页手动触发（workflow_dispatch）。

文档同步约定：功能更新时同步修改 `docs/SOP.md` 与飞书 wiki 教程页。

## License

[MIT](./LICENSE)
