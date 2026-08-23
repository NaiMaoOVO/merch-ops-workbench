# 贡献指南

感谢关注本项目。这是一个个人本地优先工具，欢迎 issue 与 PR。

## 开发流程

1. Fork / 克隆仓库，`npm install`。
2. 从 `main` 拉出功能分支：`git checkout -b feat/your-feature`。
3. 开发时保持约定：
   - 本地优先，不引入后端依赖或云端上传；
   - AI 相关改动必须保留「脱敏预览 + 手动放行」；
   - 分析口径变更需同步更新测试与 README 中的说明；
4. 提交前运行：

```bash
npm run check
```

5. 提交 PR，描述清楚动机、改动点与验证方式。

## 提交信息

使用简洁的 `type: summary` 格式（feat / fix / docs / refactor / test / chore）。

## 行为准则

保持友善与专业；讨论针对事不针对人。
