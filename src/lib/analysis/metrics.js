/**
 * Shared metric/filter/trend/rule helpers (PRD §8.6 + 阶段三扩展).
 * Pure functions only: every rate keeps its formula explicit so the report
 * can quote the exact calculation behind each number.
 */

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const safeDiv = (a, b) => (b > 0 ? a / b : 0);

export const METRIC_FORMULAS = Object.freeze({
  clickRate: '点击率 = 点击量 / 曝光量',
  visitRate: '访问率 = 访问量 / 曝光量',
  addCartRate: '加购率 = 加购件数 / 点击量',
  conversionRate: '支付转化率 = 支付件数 / 点击量',
  orderRate: '下单转化 = 支付件数 / 访问量',
  aov: '客单价 = 销售额 / 支付件数',
});

/** Add derived rates with fixed formulas; missing inputs become 0, never fake data. */
export function computeDerivedMetrics(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const impressions = num(row.impressions);
    const visits = num(row.visits);
    const clicks = num(row.clicks);
    const addToCart = num(row.addToCart ?? row.addCart);
    const paid = num(row.paid ?? row.orders);
    const salesAmount = num(row.salesAmount ?? row.revenue);
    return {
      ...row,
      impressions,
      clicks,
      paid,
      salesAmount,
      clickRate: safeDiv(clicks, impressions),
      visitRate: safeDiv(visits, impressions),
      addCartRate: safeDiv(addToCart, clicks),
      conversionRate: safeDiv(paid, clicks),
      orderRate: safeDiv(paid, visits),
      aov: paid > 0 ? salesAmount / paid : 0,
    };
  });
}

/** Filter rows by any supported dimension; absent filter keys are ignored. */
export function filterAnalysisRows(rows, filters = {}) {
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (filters.dateFrom && String(row.date ?? '') < filters.dateFrom) return false;
    if (filters.dateTo && String(row.date ?? '') > filters.dateTo) return false;
    for (const key of ['category', 'site', 'supplier', 'productId']) {
      const wanted = filters[key];
      if (wanted && String(row[key] ?? '') !== String(wanted)) return false;
    }
    return true;
  });
}

/** Sort rows into a dated series for one metric, e.g. daily salesAmount trend. */
export function buildTrendSeries(rows, { dateKey = 'date', metric = 'salesAmount' } = {}) {
  const byDate = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const date = String(row?.[dateKey] ?? '');
    if (!date) continue;
    byDate.set(date, (byDate.get(date) ?? 0) + num(row[metric]));
  }
  return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value }));
}

const ratioChange = (current, previous) => (previous > 0 ? (current - previous) / previous : null);

/** Compare two periods metric-by-metric; change is null when the base is 0. */
export function computePeriodComparison(currentRows, previousRows, metrics = ['salesAmount', 'paid', 'impressions', 'clicks']) {
  const sum = (rows, metric) => (Array.isArray(rows) ? rows : []).reduce((total, row) => total + num(row?.[metric]), 0);
  return metrics.map((metric) => {
    const current = sum(currentRows, metric);
    const previous = sum(previousRows, metric);
    const change = ratioChange(current, previous);
    return { metric, current, previous, change, changeLabel: change === null ? '无基数' : `${change >= 0 ? '+' : ''}${(change * 100).toFixed(1)}%` };
  });
}

const OPERATORS = { lt: (a, b) => a < b, lte: (a, b) => a <= b, gt: (a, b) => a > b, gte: (a, b) => a >= b };

function quantile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

/** Create a configurable anomaly rule with either an absolute or quantile threshold. */
export function createRule({ id, label, metric, operator = 'lt', threshold, quantileRatio, scope = {} }) {
  if (!id || !metric) throw new Error('规则需要 id 和 metric');
  if (!OPERATORS[operator]) throw new Error(`不支持的操作符：${operator}`);
  if (threshold === undefined && quantileRatio === undefined) throw new Error('规则需要 threshold 或 quantileRatio');
  if (quantileRatio !== undefined && (quantileRatio <= 0 || quantileRatio >= 1)) throw new Error('quantileRatio 需要在 0~1 之间');
  return { id, label: label ?? id, metric, operator, ...(threshold !== undefined ? { threshold: num(threshold) } : {}), ...(quantileRatio !== undefined ? { quantileRatio } : {}), scope };
}

function ruleThreshold(rule, rows) {
  return rule.quantileRatio !== undefined ? quantile(rows.map((row) => num(row[rule.metric])), rule.quantileRatio) : rule.threshold;
}

function inScope(rule, row) {
  return Object.entries(rule.scope ?? {}).every(([key, value]) => !value || String(row[key] ?? '') === String(value));
}

/** Evaluate configurable rules; returns one entry per matched rule. */
export function evaluateRules(rows, rules) {
  const source = computeDerivedMetrics(Array.isArray(rows) ? rows : []);
  const results = [];
  for (const rule of Array.isArray(rules) ? rules : []) {
    const threshold = ruleThreshold(rule, source);
    for (const row of source) {
      if (!inScope(rule, row)) continue;
      if (OPERATORS[rule.operator](num(row[rule.metric]), threshold)) {
        results.push({ ...row, rule: rule.id, ruleLabel: rule.label, threshold });
      }
    }
  }
  return results;
}
