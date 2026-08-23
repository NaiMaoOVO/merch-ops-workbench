/**
 * Local analysis-project persistence (PRD §8.1 + §18).
 * A project keeps its imported working copies, field mapping and analysis
 * configuration together, so switching pages or reloading continues the job.
 * Everything stays in localStorage; API keys never enter a project record.
 */

export const PROJECT_SCHEMA_VERSION = 2;
const PROJECT_KEY_PREFIX = 'merch-workbench:project:';
const REPORT_DRAFT_PREFIX = 'merch-workbench:report-draft:';

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isApiKeyField(key) {
  return /api[_-]?key/i.test(String(key));
}

export function stripSecrets(value) {
  if (Array.isArray(value)) return value.map(stripSecrets);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !isApiKeyField(key)).map(([key, item]) => [key, stripSecrets(item)]));
}

/** Normalise raw imported worksheets into the persisted working-copy shape. */
function normaliseSheets(importedFiles = []) {
  return (Array.isArray(importedFiles) ? importedFiles : []).map((sheet) => ({
    fileName: String(sheet?.fileName ?? '未命名文件'),
    name: String(sheet?.name ?? 'Sheet1'),
    headers: Array.isArray(sheet?.headers) ? sheet.headers.map(String) : Object.keys(sheet?.rows?.[0] ?? {}).map(String),
    rows: Array.isArray(sheet?.rows) ? clone(sheet.rows) : [],
  }));
}

/** Build the analysable snapshot that a project stores alongside its metadata. */
export function buildAnalysisSnapshot({ importedFiles = [], fieldMapping = {}, analysisConfig = {}, dataMode = 'imported' } = {}) {
  const sheets = normaliseSheets(importedFiles);
  return {
    dataMode,
    sheets,
    dataSources: sheets.map((sheet) => ({ fileName: sheet.fileName, sheetName: sheet.name, rowCount: sheet.rows.length, columnCount: sheet.headers.length })),
    fieldMapping: clone(fieldMapping),
    analysisConfig: clone(analysisConfig),
  };
}

/** Create a normalised project record; never trusts caller-provided ids blindly. */
export function createAnalysisProject(input = {}, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const id = String(input.id ?? `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const snapshot = input.snapshot ?? buildAnalysisSnapshot(input);
  return stripSecrets({
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id,
    name: String(input.name ?? '').trim() || '未命名分析项目',
    period: input.period ?? '未设置',
    site: input.site ?? '未设置',
    categoryRange: input.categoryRange ?? '未设置',
    status: input.status ?? '进行中',
    progress: Number.isFinite(Number(input.progress)) ? Number(input.progress) : 0,
    archived: Boolean(input.archived),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
    ...snapshot,
  });
}

/** Upgrade older records so old local data keeps working after updates. */
export function migrateProject(project) {
  if (!project || typeof project !== 'object') return null;
  const version = Number(project.schemaVersion ?? 1);
  let next = { ...clone(project) };
  if (version < 2) {
    const sheets = Array.isArray(next.sheets) ? next.sheets : [];
    next.schemaVersion = PROJECT_SCHEMA_VERSION;
    next.dataSources = Array.isArray(next.dataSources) && next.dataSources.length
      ? next.dataSources
      : sheets.map((sheet) => ({ fileName: sheet.fileName ?? '', sheetName: sheet.name ?? '', rowCount: sheet.rows?.length ?? 0, columnCount: sheet.headers?.length ?? 0 }));
  }
  next.schemaVersion = PROJECT_SCHEMA_VERSION;
  return stripSecrets(next);
}

export function saveAnalysisProject(project, storage = globalThis.localStorage) {
  if (!project?.id) throw new Error('project.id is required');
  if (!storage) throw new Error('localStorage is unavailable');
  const record = { ...migrateProject(project), updatedAt: new Date().toISOString() };
  storage.setItem(PROJECT_KEY_PREFIX + record.id, JSON.stringify(record));
  return record;
}

export function loadAnalysisProject(id, storage = globalThis.localStorage) {
  if (!id || !storage) return null;
  try {
    const raw = storage.getItem(PROJECT_KEY_PREFIX + id);
    return raw ? migrateProject(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function removeAnalysisProject(id, storage = globalThis.localStorage, options = {}) {
  if (!id || !storage) return { removedProject: false, removedDrafts: 0 };
  let removedDrafts = 0;
  if (options.includeReportDrafts) {
    const draftKey = REPORT_DRAFT_PREFIX + id;
    if (storage.getItem(draftKey) !== null) {
      storage.removeItem(draftKey);
      removedDrafts += 1;
    }
  }
  const existed = storage.getItem(PROJECT_KEY_PREFIX + id) !== null;
  storage.removeItem(PROJECT_KEY_PREFIX + id);
  return { removedProject: existed, removedDrafts };
}

/** Merge an analysis snapshot into a stored project so reports stay truthful. */
export function saveAnalysisSummary(projectId, summary, storage = globalThis.localStorage) {
  if (!projectId) throw new Error('projectId is required');
  const project = loadAnalysisProject(projectId, storage);
  if (!project) throw new Error('project not found');
  return saveAnalysisProject({ ...project, analysisSummary: { ...summary, savedAt: new Date().toISOString() } }, storage);
}

/** Most recent non-empty v2 project, so a reload continues the last job. */
export function findLatestAnalysisProject(storage = globalThis.localStorage) {
  if (!storage || storage.length === undefined) return null;
  let latest = null;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key?.startsWith(PROJECT_KEY_PREFIX)) continue;
    let parsed = null;
    try { parsed = JSON.parse(storage.getItem(key)); } catch { parsed = null; }
    const project = migrateProject(parsed);
    if (!project?.sheets?.length) continue;
    if (!latest || String(project.updatedAt ?? '') > String(latest.updatedAt ?? '')) latest = project;
  }
  return latest;
}

/** Approximate localStorage footprint of one project, in bytes. */
export function estimateProjectBytes(project) {
  try { return new Blob([JSON.stringify(project)]).size; } catch { return JSON.stringify(project ?? {}).length; }
}

/** Human readable storage size for project lists. */
export function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size >= 1024 * 1024) return (size / 1024 / 1024).toFixed(1) + ' MB';
  if (size >= 1024) return Math.round(size / 1024) + ' KB';
  return size + ' B';
}

export { applyBackup, collectBackup, summariseBackup, validateBackup, BACKUP_SCHEMA_VERSION } from './backup.js';
