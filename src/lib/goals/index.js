/** 月度目标进度：按日期前缀聚合当月销售额，与目标对比。 */
export function monthProgress({ trend = [], target = 0, monthKey } = {}) {
  const key = monthKey ?? (() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); })();
  const monthSales = (Array.isArray(trend) ? trend : [])
    .filter((point) => String(point?.date ?? '').startsWith(key))
    .reduce((total, point) => total + (Number(point?.value) || 0), 0);
  const targetNum = Math.max(0, Number(target) || 0);
  const ratio = targetNum > 0 ? Math.min(monthSales / targetNum, 9.99) : null;
  return { monthKey: key, monthSales, target: targetNum, ratio, remain: targetNum > 0 ? Math.max(targetNum - monthSales, 0) : null, done: targetNum > 0 && monthSales >= targetNum };
}

const TARGET_PREFIX = 'merch-workbench:monthly-target:';

function defaultStorage() { return typeof window !== 'undefined' ? window.localStorage : null; }

export function getMonthlyTarget(storage = defaultStorage(), projectId) {
  if (!storage || !projectId) return 0;
  return Number(storage.getItem(TARGET_PREFIX + projectId)) || 0;
}

export function setMonthlyTarget(storage = defaultStorage(), projectId, value) {
  if (!storage || !projectId) return false;
  const num = Math.max(0, Number(value) || 0);
  if (num === 0) storage.removeItem(TARGET_PREFIX + projectId);
  else storage.setItem(TARGET_PREFIX + projectId, String(num));
  return true;
}
