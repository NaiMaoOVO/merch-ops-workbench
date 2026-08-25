export const ANNOTATIONS_KEY = 'merch-workbench:annotations';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function defaultStorage() { return typeof window !== 'undefined' ? window.localStorage : null; }

/** 解析标注原始字符串为 { 日期: 标签 } 映射；非法条目自动忽略。 */
export function parseAnnotations(raw) {
  const result = {};
  try {
    const parsed = JSON.parse(String(raw ?? '') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return result;
    for (const [date, label] of Object.entries(parsed)) {
      if (DATE_PATTERN.test(date) && typeof label === 'string' && label.trim()) result[date] = label.trim();
    }
  } catch { /* 损坏数据按空处理 */ }
  return result;
}

export function loadAnnotations(storage = defaultStorage()) {
  try {
    return parseAnnotations(storage?.getItem(ANNOTATIONS_KEY));
  } catch {
    return {};
  }
}

export function saveAnnotations(map, storage = defaultStorage()) {
  storage?.setItem(ANNOTATIONS_KEY, JSON.stringify(map ?? {}));
  return map ?? {};
}

/** 新增或更新某天标注（标签为空则删除该天）。返回新映射。 */
export function upsertAnnotation(map, date, label) {
  const next = { ...parseAnnotations(JSON.stringify(map ?? {})) };
  if (!DATE_PATTERN.test(String(date ?? ''))) return next;
  const clean = String(label ?? '').trim();
  if (!clean) delete next[date];
  else next[date] = clean.slice(0, 40);
  return next;
}
