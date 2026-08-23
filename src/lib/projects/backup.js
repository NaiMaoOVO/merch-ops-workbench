const STORAGE_PREFIX = 'merch-workbench:';
const BACKUP_APP_ID = 'merch-workbench';
export const BACKUP_SCHEMA_VERSION = 1;

function defaultStorage() { return typeof window !== 'undefined' ? window.localStorage : null; }

/** 收集本地存储中全部 merch-workbench 键值，形成可恢复的完整快照。 */
export function collectBackup(storage = defaultStorage()) {
  if (!storage) return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), entries: [] };
  const entries = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    entries.push({ key, value: storage.getItem(key) ?? '' });
  }
  entries.sort((left, right) => left.key.localeCompare(right.key));
  return { app: BACKUP_APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: new Date().toISOString(), entries };
}

/** 校验备份包结构，返回 { ok, errors }。 */
export function validateBackup(parsed) {
  const errors = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, errors: ['备份文件不是有效的 JSON 对象。'] };
  }
  if (parsed.app !== BACKUP_APP_ID) errors.push('这不是本工作台导出的备份文件。');
  if (!Array.isArray(parsed.entries)) errors.push('备份缺少 entries 列表。');
  else {
    parsed.entries.forEach((entry, index) => {
      if (!entry || typeof entry.key !== 'string' || !entry.key.startsWith(STORAGE_PREFIX)) {
        errors.push(`第 ${index + 1} 条记录的键名不在工作台命名空间内。`);
      }
      if (!entry || typeof entry.value !== 'string') errors.push(`第 ${index + 1} 条记录的值必须是字符串。`);
    });
  }
  return { ok: errors.length === 0, errors };
}

/** 把快照写回本地存储（同键覆盖），返回写入条数。 */
export function applyBackup(parsed, storage = defaultStorage()) {
  const verdict = validateBackup(parsed);
  if (!verdict.ok) throw new Error(verdict.errors[0]);
  if (!storage) throw new Error('当前环境没有可用的本地存储。');
  parsed.entries.forEach((entry) => storage.setItem(entry.key, entry.value));
  return parsed.entries.length;
}

/** 按类别统计快照内容，用于导入前的确认提示。 */
export function summariseBackup(parsed) {
  const summary = { total: 0, project: 0, reportDraft: 0, task: 0, issue: 0, trend: 0, other: 0 };
  if (!parsed || !Array.isArray(parsed.entries)) return summary;
  parsed.entries.forEach(({ key }) => {
    summary.total += 1;
    if (key.includes(':project:')) summary.project += 1;
    else if (key.includes(':report-draft:')) summary.reportDraft += 1;
    else if (key.endsWith(':tasks')) summary.task += 1;
    else if (key.endsWith(':issues')) summary.issue += 1;
    else if (key.endsWith(':trends')) summary.trend += 1;
    else summary.other += 1;
  });
  return summary;
}
