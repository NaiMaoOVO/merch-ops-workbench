export const HEAT_LEVELS = Object.freeze(['高', '中', '低']);
export const SOURCE_CREDIBILITIES = Object.freeze(['高', '中', '低']);
export const TREND_STATUSES = Object.freeze(['待验证', '已验证', '已转化', '已归档']);

const asList = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value).split(/[,，;；|\n]/).map((item) => item.trim()).filter(Boolean);
};

const unique = (items) => [...new Set(asList(items))];
const nowIso = () => new Date().toISOString();

export function createTrendNote(input = {}, options = {}) {
  const keyword = String(input.keyword ?? '').trim();
  if (!keyword) throw new Error('Trend keyword is required');
  const now = options.now ?? nowIso();
  const productIds = unique(input.productIds?.length ? input.productIds : input.productId);
  const categoryIds = unique(input.categoryIds?.length ? input.categoryIds : input.categoryId);
  const discoveredDate = String(input.discoveredDate ?? now.slice(0, 10)).slice(0, 10);
  return {
    noteId: options.id ?? input.noteId ?? `trend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    keyword,
    categoryIds,
    productIds,
    sourcePlatform: String(input.sourcePlatform ?? '').trim(),
    sourceUrl: String(input.sourceUrl ?? '').trim(),
    attachmentNote: String(input.attachmentNote ?? input.attachment ?? '').trim(),
    discoveredDate,
    heatLevel: HEAT_LEVELS.includes(input.heatLevel) ? input.heatLevel : '中',
    sourceCredibility: SOURCE_CREDIBILITIES.includes(input.sourceCredibility) ? input.sourceCredibility : '中',
    status: TREND_STATUSES.includes(input.status) ? input.status : '待验证',
    observation: String(input.observation ?? '').trim(),
    nextAction: String(input.nextAction ?? '').trim(),
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
}

export function updateTrendNote(notes = [], noteId, patch = {}, updatedAt = nowIso()) {
  let found = false;
  const next = notes.map((note) => {
    if (note.noteId !== noteId) return note;
    found = true;
    const merged = { ...note, ...patch, updatedAt };
    if (patch.keyword !== undefined) {
      merged.keyword = String(patch.keyword).trim();
      if (!merged.keyword) throw new Error('Trend keyword is required');
    }
    if (patch.productIds !== undefined) merged.productIds = unique(patch.productIds);
    if (patch.categoryIds !== undefined) merged.categoryIds = unique(patch.categoryIds);
    if (patch.heatLevel !== undefined && !HEAT_LEVELS.includes(patch.heatLevel)) throw new Error(`Unsupported trend heat level: ${patch.heatLevel}`);
    if (patch.sourceCredibility !== undefined && !SOURCE_CREDIBILITIES.includes(patch.sourceCredibility)) throw new Error(`Unsupported source credibility: ${patch.sourceCredibility}`);
    if (patch.status !== undefined && !TREND_STATUSES.includes(patch.status)) throw new Error(`Unsupported trend status: ${patch.status}`);
    return merged;
  });
  if (!found) throw new Error(`Trend note not found: ${noteId}`);
  return next;
}

export function associateProducts(notes = [], noteId, productIds = []) {
  return updateTrendNote(notes, noteId, { productIds: unique(productIds) });
}

export function associateCategories(notes = [], noteId, categoryIds = []) {
  return updateTrendNote(notes, noteId, { categoryIds: unique(categoryIds) });
}

export function filterTrendNotes(notes = [], options = {}) {
  const query = String(options.query ?? '').trim().toLocaleLowerCase();
  return notes.filter((note) => {
    if (options.heatLevel && note.heatLevel !== options.heatLevel) return false;
    if (options.sourceCredibility && note.sourceCredibility !== options.sourceCredibility) return false;
    if (options.status && note.status !== options.status) return false;
    if (options.productId && !asList(note.productIds?.length ? note.productIds : note.productId).includes(String(options.productId))) return false;
    if (options.categoryId && !asList(note.categoryIds?.length ? note.categoryIds : note.categoryId).includes(String(options.categoryId))) return false;
    if (options.dateFrom && String(note.discoveredDate) < String(options.dateFrom)) return false;
    if (options.dateTo && String(note.discoveredDate) > String(options.dateTo)) return false;
    if (query) {
      const haystack = [note.keyword, note.sourcePlatform, note.observation, note.nextAction, note.sourceUrl].join(' ').toLocaleLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function sortTrendNotes(notes = [], options = {}) {
  const heatRank = { 高: 0, 中: 1, 低: 2 };
  const direction = options.direction === 'asc' ? 1 : -1;
  return [...notes].sort((a, b) => {
    const dateDiff = String(a.discoveredDate ?? '').localeCompare(String(b.discoveredDate ?? ''));
    if (dateDiff) return direction * dateDiff;
    return (heatRank[a.heatLevel] ?? 1) - (heatRank[b.heatLevel] ?? 1);
  });
}

export function summarizeTrendNotes(notes = []) {
  return {
    total: notes.length,
    active: notes.filter((note) => note.status !== '已归档').length,
    highHeat: notes.filter((note) => note.heatLevel === '高').length,
    verified: notes.filter((note) => note.status === '已验证').length,
    highCredibility: notes.filter((note) => note.sourceCredibility === '高').length,
  };
}
