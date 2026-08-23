# IndexedDB 迁移方案（P1 打地基）

> 状态：设计定稿，待分阶段实施。本文档是迁移的唯一事实来源。

## 1. 为什么必须迁移

- 现状：全部数据存 `localStorage`，浏览器配额通常 **5–10 MB**（按 UTF-16 计约 2.5–5M 字符）。
- 日粒度使用后：每天一份日报 ≈ 数十 KB；一个季度即逼近上限，且超限写入会**静默抛错**。
- IndexedDB 配额一般为可用磁盘的数十个百分点（GB 级），并支持结构化克隆、索引与游标。

## 2. 现有键位清单（迁移对象盘点）

| 前缀 / 键 | 内容 | 迁移优先级 |
| --- | --- | --- |
| merch-workbench:project:{id} | 项目全量（含导入副本行数据，体积大头） | **P0（先迁）** |
| merch-workbench:report-draft:{id} | 报告草稿 | P0 |
| merch-workbench:tasks / issues / trends | 台账 | P1 |
| merch-workbench:mapping-memory:* | 映射记忆（20 条 LRU） | P2 |
| merch-workbench:monthly-target:{id} | 月度目标 | P2 |
| 其余 merch-workbench:* | 兜底归类 kv store | P2 |

## 3. 目标架构

```
IndexedDB 库：merch-workbench（version 1）
├─ objectStore: projects  keyPath=id   （项目 + 报告草稿并入 meta 字段或独立 store drafts keyPath=projectId）
├─ objectStore: kv        keyPath=key  （tasks/issues/trends/targets/mapping-memory 等）
└─ objectStore: meta      keyPath=key  （schema 版本、迁移水位）
```

适配层 `src/lib/storage/idb.js`：

```ts
openDatabase(): Promise<IDBDatabase>
idbGet(store, key) / idbSet(store, key, value) / idbDelete(store, key) / idbAllKeys(store, prefix?)
```

上层新增 `src/lib/storage/facade.js`，对外暴露与现在同步接口同名的 **异步 facade**：

```ts
storageGet(key): Promise<string|null>
storageSet(key, value): Promise<void>
storageKeys(prefix): Promise<string[]>
storageRemove(key): Promise<void>
```

## 4. 兼容与降级策略

1. **能力探测**：启动时 `indexedDB in window` 探测；不可用（旧 Safari 隐私模式等）→ 全量回退现有 localStorage 路径，功能不缩水。
2. **一次性迁移**：首次进入时若 IDB 为空且 localStorage 有数据 → 逐键拷入 → 写 meta.migratedAt 水位 → **localStorage 原样保留一个版本周期**（回滚保险），之后清理。
3. **双写过渡**：迁移后前两个版本采用「IDB 为主 + localStorage 镜像小键（targets/mapping-memory）」，防止降级路径丢数据。
4. 备份兼容：`collectBackup` 改为 async，聚合两个来源；导出文件格式不变（仍是 entries 列表），老备份可导入。

## 5. 实施阶段

| 阶段 | 内容 | 验收标准 |
| --- | --- | --- |
| A | idb.js + facade + 单测（fake-indexeddb） | 单测覆盖 get/set/keys/delete 与降级分支 |
| B | 启动迁移器 + 双写 | 旧数据自动迁入；断网/隐私模式回退可用 |
| C | 各模块切换到 facade（projects → drafts → kv） | npm run check 绿；手动回归备份/恢复 |
| D | 移除双写，清理 localStorage 水位前的旧键 | 存储面板可见占用下降 |

## 6. 风险清单

- **Safari 私有模式** IDB 可能抛错：所有入口 try/catch 回退 localStorage。
- **多标签页并发写**：以「整键覆盖」为写模型的项目存储天然幂等；kv 类引入 Web Locks（可选）或接受最后写入获胜（当前单用户场景可接受）。
- **测试环境无 IDB**：统一用 fake-indexeddb 注入。
