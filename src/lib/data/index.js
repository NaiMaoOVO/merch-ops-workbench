/**
 * Small, UI-agnostic data preparation primitives used by the workbench.
 * Rows are plain objects so the same functions work with browser file input
 * and with exported JSON fixtures.
 */

const EMPTY_VALUES = new Set([undefined, null, '']);

function asRows(table) {
  if (Array.isArray(table)) return table;
  if (table && Array.isArray(table.rows)) return table.rows;
  return [];
}

function asHeaders(table) {
  if (table && Array.isArray(table.headers)) return table.headers.map(String);
  const rows = asRows(table);
  return [...new Set(rows.flatMap((row) => row && typeof row === 'object' ? Object.keys(row) : []))];
}

function isEmpty(value) {
  return EMPTY_VALUES.has(value) || (typeof value === 'string' && value.trim() === '');
}

function normalise(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./\\()[\]{}（）【】]/g, '');
}

function valuesForColumn(rows, column) {
  return rows.map((row) => row?.[column]);
}

/** Infer a display-oriented type from non-empty sample values. */
export function inferColumnType(values) {
  const present = values.filter((value) => !isEmpty(value));
  if (present.length === 0) return 'unknown';

  const booleans = present.every((value) => typeof value === 'boolean' || /^(true|false)$/i.test(String(value).trim()));
  if (booleans) return 'boolean';

  const numbers = present.every((value) => typeof value === 'number' || (
    typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value.replace(/,/g, '')))
  ));
  if (numbers) return 'number';

  const dates = present.every((value) => {
    if (value instanceof Date) return !Number.isNaN(value.valueOf());
    if (typeof value === 'number') return false;
    const text = String(value).trim();
    return /^\d{4}[-/]\d{1,2}[-/]\d{1,2}(?:[T\s].*)?$/.test(text) && !Number.isNaN(Date.parse(text));
  });
  if (dates) return 'date';
  return 'string';
}

/** Return a bounded preview and lightweight metadata without mutating input. */
export function previewTable(table, options = {}) {
  const limit = Math.max(0, Number.isFinite(options.limit) ? options.limit : 50);
  const headers = asHeaders(table);
  const rows = asRows(table);
  const columns = headers.map((name) => {
    const values = valuesForColumn(rows, name);
    const present = values.filter((value) => !isEmpty(value));
    return {
      name,
      type: inferColumnType(values),
      nonEmptyCount: present.length,
      emptyCount: values.length - present.length,
      examples: [...new Set(present.map((value) => String(value)))].slice(0, 3),
    };
  });
  return { headers, columns, rows: rows.slice(0, limit).map((row) => ({ ...row })) };
}

const FIELD_ALIASES = {
  productid: ['商品id', '商品编号', '商品编码', '货号', 'spuid', 'skuid', 'productid', 'itemid', 'id'],
  salesamount: ['销售额', '成交额', '支付金额', '销售金额', 'gmv', 'salesamount', 'sales', 'revenue', 'amount'],
  category: ['品类', '类目', '商品类目', 'category', 'productcategory'],
  supplier: ['供应商', '供应商编码', '商家', 'supplier', 'merchant', 'vendor'],
  title: ['标题', '商品标题', 'title', 'producttitle'],
};

function aliasMatches(source, target) {
  const sourceKey = normalise(source);
  const targetKey = normalise(target);
  if (sourceKey === targetKey) return 1;
  const aliases = FIELD_ALIASES[targetKey] ?? Object.values(FIELD_ALIASES).find((items) => items.some((alias) => normalise(alias) === targetKey)) ?? [];
  if (aliases.some((alias) => normalise(alias) === sourceKey)) return 0.96;
  if (aliases.some((alias) => sourceKey.includes(normalise(alias)) || normalise(alias).includes(sourceKey))) return 0.72;
  return 0;
}

/** Suggest source columns for canonical target fields. Never changes data. */
export function suggestFieldMappings(sourceHeaders, targetFields) {
  const sources = sourceHeaders.map(String);
  return targetFields.map((target) => {
    const ranked = sources
      .map((source) => ({ source, score: aliasMatches(source, target) }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.source.localeCompare(b.source));
    const best = ranked[0];
    return {
      target,
      source: best?.source ?? null,
      confidence: best ? best.score : 0,
      reason: best ? (best.score === 1 ? 'exact' : 'alias') : 'no-match',
    };
  });
}

/* ------------------------- manual mapping editor (PRD §8.3) ------------------------- */

/** Merge user edits into the current mapping; empty source clears a target. */
export function applyManualMapping(mapping, target, source) {
  const next = { ...mapping };
  if (source) next[target] = String(source);
  else delete next[target];
  return next;
}

/**
 * Validate a manual/automatic mapping before analysis runs.
 * Errors block analysis; warnings only inform. Duplicate sources are errors
 * because two business fields cannot safely read the same column.
 */
export function validateFieldMapping(mapping, options = {}) {
  const entries = Object.entries(mapping ?? {}).filter(([, source]) => Boolean(source));
  const errors = [];
  const warnings = [];
  for (const target of options.requiredTargets ?? []) {
    if (!entries.some(([key]) => key === target)) errors.push({ code: 'missing-required', target, message: `缺少必选字段「${target}」的映射。` });
  }
  const bySource = new Map();
  for (const [target, source] of entries) {
    const previous = bySource.get(source);
    if (previous) errors.push({ code: 'duplicate-source', target, source, message: `列「${source}」同时映射到 ${previous} 和 ${target}，请修正。` });
    else bySource.set(source, target);
  }
  for (const suggestion of options.suggestions ?? []) {
    if (!suggestion.source) continue;
    const manual = entries.find(([target]) => target === suggestion.target);
    if (!manual && suggestion.confidence > 0 && suggestion.confidence < 0.9) warnings.push({ code: 'low-confidence', target: suggestion.target, source: suggestion.source, message: `「${suggestion.target} → ${suggestion.source}」为低置信度推荐，请人工确认。` });
  }
  return { valid: errors.length === 0, errors, warnings, usedSources: [...bySource.keys()] };
}

/** Rename rows through a confirmed mapping so shared analysis keeps one shape. */
export function applyMappingToRows(rows, mapping) {
  return (Array.isArray(rows) ? rows : []).map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => {
    const target = Object.entries(mapping).find(([, source]) => source === column)?.[0];
    return [target ?? column, value];
  })));
}

/**
 * Suggest join keys between two imported sheets: columns whose normalised
 * names match exactly. Helps users wire multi-sheet matches safely (PRD §8.4).
 */
export function suggestJoinKeys(leftHeaders = [], rightHeaders = []) {
  const norm = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const rightByName = new Map(rightHeaders.map((header) => [norm(header), header]));
  const suggestions = [];
  for (const header of leftHeaders) {
    const key = norm(header);
    if (!key) continue; // 纯中文等被完全规范化的名字不参与自动推荐，交给人工选择
    const match = rightByName.get(key);
    if (match) suggestions.push({ left: header, right: match });
  }
  return suggestions;
}

export function buildMappingTemplate(name, mapping, meta = {}) {
  if (!String(name).trim()) throw new Error('模板名称不能为空');
  return {
    type: 'field-mapping',
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    mapping: { ...mapping },
    site: meta.site ?? '通用',
    categoryRange: meta.categoryRange ?? '通用',
    createdAt: meta.now ?? new Date().toISOString(),
  };
}

function keyValue(row, key) {
  const value = row?.[key];
  return isEmpty(value) ? null : String(value).trim();
}

function pickColumns(row, columns) {
  return Object.fromEntries(columns.map((column) => [column, row?.[column] ?? null]));
}

/**
 * Left-join two row sets. One-to-many matches intentionally expand rows;
 * report.rowCountInflation makes that potentially dangerous change explicit.
 */
export function matchTables(primaryTable, secondaryTable, options = {}) {
  const primaryRows = asRows(primaryTable);
  const secondaryRows = asRows(secondaryTable);
  const primaryKey = options.primaryKey;
  const secondaryKey = options.secondaryKey ?? primaryKey;
  if (!primaryKey || !secondaryKey) throw new Error('primaryKey and secondaryKey are required');

  const secondaryByKey = new Map();
  const duplicateSecondaryKeys = new Set();
  const secondaryKeys = new Set();
  let emptySecondaryKeyCount = 0;
  for (const row of secondaryRows) {
    const key = keyValue(row, secondaryKey);
    if (key === null) { emptySecondaryKeyCount += 1; continue; }
    secondaryKeys.add(key);
    const matches = secondaryByKey.get(key) ?? [];
    if (matches.length > 0) duplicateSecondaryKeys.add(key);
    matches.push(row);
    secondaryByKey.set(key, matches);
  }

  const rows = [];
  const matchedSecondaryKeys = new Set();
  const unmatchedPrimaryKeys = new Set();
  let emptyPrimaryKeyCount = 0;
  for (const primaryRow of primaryRows) {
    const key = keyValue(primaryRow, primaryKey);
    if (key === null) {
      emptyPrimaryKeyCount += 1;
      rows.push({ ...primaryRow });
      continue;
    }
    const matches = secondaryByKey.get(key);
    if (!matches?.length) {
      unmatchedPrimaryKeys.add(key);
      rows.push({ ...primaryRow });
      continue;
    }
    matchedSecondaryKeys.add(key);
    for (const secondaryRow of matches) {
      rows.push(options.columns?.length ? { ...primaryRow, ...pickColumns(secondaryRow, options.columns) } : { ...primaryRow, ...secondaryRow });
    }
  }

  return {
    rows,
    report: {
      primaryRowCount: primaryRows.length,
      secondaryRowCount: secondaryRows.length,
      outputRowCount: rows.length,
      rowCountInflation: Math.max(0, rows.length - primaryRows.length),
      unmatchedPrimaryKeys: [...unmatchedPrimaryKeys],
      unmatchedSecondaryKeys: [...secondaryKeys].filter((key) => !matchedSecondaryKeys.has(key)),
      duplicateSecondaryKeys: [...duplicateSecondaryKeys],
      emptyPrimaryKeyCount,
      emptySecondaryKeyCount,
    },
  };
}

/**
 * PRD §8.4 连续匹配：left-join the accumulated rows through an ordered list of
 * dimension tables (e.g. 销售 → 商品 → 品类 → 供应商). Each step keeps its own
 * report so users confirm joins incrementally; optional column selection keeps
 * the wide result readable and avoids silent same-name field conflicts.
 */
export function chainJoins(primaryTable, steps = []) {
  let rows = asRows(primaryTable);
  const reports = steps.map((step, index) => {
    const result = matchTables(rows, step.table ?? [], {
      primaryKey: step.key,
      secondaryKey: step.foreignKey ?? step.key,
      columns: step.columns,
    });
    rows = result.rows;
    return {
      step: index + 1,
      label: step.label ?? `第 ${index + 1} 步匹配`,
      matchedBy: step.foreignKey ? `${step.key} ↔ ${step.foreignKey}` : String(step.key),
      keptColumns: step.columns ? [...step.columns] : null,
      ...result.report,
    };
  });
  return { rows, reports };
}

/** Structural and key-level checks suitable for an import preview. */
export function checkDataQuality(table, options = {}) {
  const headers = asHeaders(table);
  const rows = asRows(table);
  const issues = [];
  const seenHeaders = new Set();
  for (const header of headers) {
    if (isEmpty(header)) issues.push({ code: 'empty_header', severity: 'error', header });
    if (seenHeaders.has(header)) issues.push({ code: 'duplicate_header', severity: 'error', header });
    seenHeaders.add(header);
  }

  const key = options.key;
  if (key) {
    const seenKeys = new Set();
    rows.forEach((row, index) => {
      const value = keyValue(row, key);
      if (value === null) issues.push({ code: 'empty_key', severity: 'warning', rowIndex: index, key });
      else if (seenKeys.has(value)) issues.push({ code: 'duplicate_key', severity: 'warning', rowIndex: index, key, value });
      else seenKeys.add(value);
    });
  }

  const missingByColumn = headers.map((header) => {
    const emptyCount = valuesForColumn(rows, header).filter(isEmpty).length;
    return { header, emptyCount, ratio: rows.length ? emptyCount / rows.length : 0 };
  }).filter((item) => item.emptyCount > 0);
  if (missingByColumn.length) issues.push({ code: 'missing_values', severity: 'info', columns: missingByColumn });

  return { rowCount: rows.length, columnCount: headers.length, headers, issues, missingByColumn };
}

/**
 * Parse a local XLSX/XLS/CSV file. The `xlsx` package is loaded lazily so the
 * pure functions above remain usable in tests and in builds without a parser.
 */
export async function parseSpreadsheet(input, options = {}) {
  const csvText = typeof input === 'string' && (options.format === 'csv' || options.format === 'text/csv' || options.csv === true);
  // Excel 导出的 CSV 常带 UTF-8 BOM，不剥离会污染第一个表头并导致字段匹配失败
  if (csvText) return [{ name: options.name ?? 'Sheet1', ...parseCsv(String(input).replace(/^\uFEFF/, ''), options) }];

  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('Spreadsheet parsing requires the optional "xlsx" dependency');
  }
  let data = input;
  if (input && typeof input.arrayBuffer === 'function') data = await input.arrayBuffer();
  const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: true });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: false });
    return { name, ...previewTable(rows, { limit: options.previewLimit ?? 50 }), rows };
  });
}

function parseCsv(text, options = {}) {
  const delimiter = options.delimiter ?? (text.includes('\t') && !text.includes(',') ? '\t' : ',');
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (character === '"' && quoted && next === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === delimiter && !quoted) { row.push(cell); cell = ''; continue; }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell); records.push(row); row = []; cell = ''; continue;
    }
    cell += character;
  }
  if (cell !== '' || row.length) { row.push(cell); records.push(row); }
  const headers = (records.shift() ?? []).map((header) => header.trim());
  const rows = records.filter((values) => values.some((value) => value !== '')).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? null]),
  ));
  return { headers, ...previewTable({ headers, rows }, { limit: options.previewLimit ?? 50 }), rows };
}

export const readSpreadsheet = parseSpreadsheet;

/* ==================== 映射记忆（P0：同结构文件自动套用上次映射） ==================== */

const MAPPING_MEMORY_PREFIX = 'merch-workbench:mapping-memory:';
const MAPPING_MEMORY_LIMIT = 20;

function normalizeColumnName(header) {
  return String(header ?? '').toLowerCase().replace(/\s+/g, '');
}

function hashText(text) {
  let hash = 5381;
  const source = String(text);
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}

/** 列名指纹：与顺序无关、大小写与空白不敏感；空表返回空串。 */
export function fingerprintColumns(headers) {
  const names = [...new Set((Array.isArray(headers) ? headers : []).map(normalizeColumnName).filter(Boolean))].sort();
  return names.length ? names.join('|') : '';
}

function memoryKey(fingerprint) { return MAPPING_MEMORY_PREFIX + hashText(fingerprint); }

function defaultStorage() { return typeof window !== 'undefined' ? window.localStorage : null; }

/** 记住某列结构下的人工映射（含自动识别后被确认过的结果）；最多保留 20 条，超出淘汰最旧。 */
export function rememberMapping(storage, fingerprint, fieldMapping, meta = {}) {
  const store = storage ?? defaultStorage();
  const cleanFingerprint = String(fingerprint ?? '').trim();
  if (!store || !cleanFingerprint || !fieldMapping || Object.keys(fieldMapping).length === 0) return false;
  const record = { fingerprint: cleanFingerprint, fieldMapping, savedAt: meta.savedAt ?? new Date().toISOString(), label: meta.label ?? '' };
  store.setItem(memoryKey(cleanFingerprint), JSON.stringify(record));
  const keys = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && key.startsWith(MAPPING_MEMORY_PREFIX)) keys.push(key);
  }
  if (keys.length > MAPPING_MEMORY_LIMIT) {
    const entries = keys.map((key) => {
      try { return { key, savedAt: JSON.parse(store.getItem(key) ?? '{}').savedAt ?? '' }; } catch { return { key, savedAt: '' }; }
    }).sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    entries.slice(0, entries.length - MAPPING_MEMORY_LIMIT).forEach((entry) => store.removeItem(entry.key));
  }
  return true;
}

/** 按列结构取回上次使用的映射；没有则返回 null。 */
export function loadRememberedMapping(storage, fingerprint) {
  const store = storage ?? defaultStorage();
  if (!store) return null;
  const raw = store.getItem(memoryKey(String(fingerprint ?? '').trim()));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.fieldMapping === 'object' ? parsed.fieldMapping : null;
  } catch { return null; }
}

