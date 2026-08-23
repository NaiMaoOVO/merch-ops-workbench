import { saveProject } from '../../lib/workspace/index.js';

const PROJECT_PREFIX = 'merch-workbench:project:';
const CONFLICT_STRATEGIES = Object.freeze(['skip', 'overwrite', 'copy']);

function clone(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}

function isApiKeyField(key) {
  return /^(api[_-]?key|apikey)$/i.test(String(key)) || /api[_-]?key/i.test(String(key));
}

function withoutApiKeys(value) {
  if (Array.isArray(value)) return value.map(withoutApiKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isApiKeyField(key)).map(([key, item]) => [key, withoutApiKeys(item)]));
}

function parseProject(raw) {
  if (!raw) return null;
  try {
    const project = JSON.parse(raw);
    return project?.id ? project : null;
  } catch {
    return null;
  }
}

export function listProjects(projectsOrStorage = [], options = {}) {
  const includeArchived = Boolean(options.includeArchived);
  let projects;
  if (Array.isArray(projectsOrStorage)) projects = projectsOrStorage;
  else {
    const storage = projectsOrStorage;
    projects = [];
    if (storage?.length !== undefined) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith(PROJECT_PREFIX)) {
          const project = parseProject(storage.getItem(key));
          if (project) projects.push(project);
        }
      }
    }
  }
  return projects
    .filter((project) => includeArchived || !project.archived)
    .slice()
    .sort((a, b) => String(b.updatedAt ?? b.createdAt ?? '').localeCompare(String(a.updatedAt ?? a.createdAt ?? '')));
}

export function cloneProject(project, options = {}) {
  if (!project?.id) throw new Error('project.id is required');
  const now = options.now ?? new Date().toISOString();
  const id = options.id ?? `${project.id}-copy-${Date.now()}`;
  const copy = clone(project);
  return { ...copy, id, name: `${copy.name ?? copy.id}（副本）`, archived: false, archivedAt: undefined, createdAt: copy.createdAt ?? now, updatedAt: now };
}

export function archiveProject(project, archived = true, now = new Date().toISOString()) {
  if (!project?.id) throw new Error('project.id is required');
  return { ...clone(project), archived: Boolean(archived), archivedAt: archived ? now : undefined, updatedAt: now };
}

export function buildBackupPayload({ projects = [], templates = [], settings = {} } = {}, options = {}) {
  return {
    type: 'merch-workbench-backup',
    version: 1,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    projects: withoutApiKeys(projects),
    templates: withoutApiKeys(templates),
    settings: withoutApiKeys(settings),
  };
}

export function serialiseBackup(data, options = {}) {
  return JSON.stringify(buildBackupPayload(data, options), null, 2);
}

export function parseBackup(serialised) {
  let payload;
  try { payload = typeof serialised === 'string' ? JSON.parse(serialised) : serialised; } catch { throw new Error('备份文件不是有效的 JSON'); }
  if ((!payload?.type || payload.type === 'merch-workbench-backup') && Array.isArray(payload?.projects)) return buildBackupPayload(payload, { exportedAt: payload.exportedAt });
  throw new Error('备份文件格式不受支持');
}

export function restoreBackup(payload, existingProjects = [], options = {}) {
  const strategy = options.strategy ?? 'skip';
  if (!CONFLICT_STRATEGIES.includes(strategy)) throw new Error(`Unsupported conflict strategy: ${strategy}`);
  const backup = parseBackup(payload);
  const projects = existingProjects.slice();
  const byId = new Map(projects.map((project) => [project.id, project]));
  const restoredIds = [];
  for (const incoming of backup.projects) {
    if (!byId.has(incoming.id)) { projects.push(incoming); byId.set(incoming.id, incoming); restoredIds.push(incoming.id); continue; }
    if (strategy === 'skip') continue;
    if (strategy === 'overwrite') {
      const index = projects.findIndex((project) => project.id === incoming.id);
      projects[index] = incoming;
      byId.set(incoming.id, incoming);
      restoredIds.push(incoming.id);
      continue;
    }
    const copyId = options.idFactory?.(incoming) ?? `${incoming.id}-copy-${Date.now()}`;
    const copy = cloneProject(incoming, { id: copyId, now: incoming.updatedAt ?? new Date().toISOString() });
    projects.push(copy);
    byId.set(copy.id, copy);
    restoredIds.push(copy.id);
  }
  return { ...backup, projects, restoredIds };
}

export function saveHistoryProject(project, storage = globalThis.localStorage) {
  if (!project?.id) throw new Error('project.id is required');
  return saveProject(project, storage);
}

/** Build a read-only comparison model for two historical projects. */
export function compareProjects(left, right) {
  if (!left?.id || !right?.id) throw new Error('两个可用项目才能进行对比');
  const fields = [
    { key: 'period', label: '分析周期', format: (value) => value || '未设置' },
    { key: 'site', label: '站点', format: (value) => value || '未设置' },
    { key: 'categoryRange', label: '品类范围', format: (value) => value || '未设置' },
    { key: 'status', label: '项目状态', format: (value) => value || '未设置' },
    { key: 'progress', label: '完成进度', format: (value) => Math.round((Number(value) || 0) * 100) + '%' },
    { key: 'selectedTables', label: '数据表数量', format: (value) => String(Array.isArray(value) ? value.length : Number(value) || 0) },
    { key: 'updatedAt', label: '最后更新时间', format: (value) => String(value || '未设置').slice(0, 16).replace('T', ' ') },
  ];
  return {
    left: { id: left.id, name: left.name || left.id },
    right: { id: right.id, name: right.name || right.id },
    rows: fields.map((field) => ({
      key: field.key,
      label: field.label,
      left: field.format(left[field.key]),
      right: field.format(right[field.key]),
      changed: field.format(left[field.key]) !== field.format(right[field.key]),
    })),
  };
}

export { CONFLICT_STRATEGIES, PROJECT_PREFIX };
