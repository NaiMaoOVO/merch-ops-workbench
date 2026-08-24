const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const safeRate = (numerator, denominator) => denominator > 0 ? numerator / denominator : 0;

export function aggregateBy(rows, groupKey) {
  const groups = new Map();
  for (const row of rows) {
    const group = row?.[groupKey] ?? '未分类';
    const item = groups.get(group) ?? { group, impressions: 0, clicks: 0, paid: 0, salesAmount: 0 };
    item.impressions += number(row.impressions);
    item.clicks += number(row.clicks);
    item.paid += number(row.paid);
    item.salesAmount += number(row.salesAmount);
    groups.set(group, item);
  }
  return [...groups.values()].map((item) => ({ ...item, clickRate: safeRate(item.clicks, item.impressions), conversionRate: safeRate(item.paid, item.clicks) }));
}

function quantile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

export function detectAnomalies(rows, options = {}) {
  const impressionQuantile = options.impressionQuantile ?? 0.7;
  const lowClickRate = options.lowClickRate ?? 0.02;
  const lowConversionRate = options.lowConversionRate ?? 0.08;
  const impressionThreshold = quantile(rows.map((row) => number(row.impressions)), impressionQuantile);
  const results = [];
  for (const row of rows) {
    const impressions = number(row.impressions);
    const clicks = number(row.clicks);
    const paid = number(row.paid);
    const clickRate = safeRate(clicks, impressions);
    const conversionRate = safeRate(paid, clicks);
    if (impressions >= impressionThreshold && clickRate < lowClickRate) results.push({ ...row, rule: 'high-impression-low-click', impressions, clickRate, conversionRate });
    if (clickRate > 0 && conversionRate < lowConversionRate) results.push({ ...row, rule: 'low-conversion', impressions, clickRate, conversionRate });
  }
  return results;
}

export function buildDiagnostic(anomaly, options = {}) {
  return {
    id: `diagnostic-${anomaly.productId}-${anomaly.rule}`,
    status: '待确认',
    priority: anomaly.rule === 'high-impression-low-click' ? '高' : '中',
    finding: `${anomaly.productId} 触发${anomaly.rule === 'high-impression-low-click' ? '高曝光低点击' : '低转化'}规则`,
    evidence: { fields: ['impressions', 'clickRate', 'conversionRate'], values: { impressions: anomaly.impressions, clickRate: anomaly.clickRate, conversionRate: anomaly.conversionRate } },
    hypothesis: { text: options.hypothesis ?? '需要结合标题、主图、价格和流量人群进一步验证。', isAiAssisted: Boolean(options.hypothesis), label: '辅助假设' },
    suggestedAction: options.suggestedAction ?? '检查商品事实、标题卖点和流量来源，记录人工结论。',
  };
}

/**
 * PRD §8.6：按商品把销售汇总并入流量行，供漏斗与异常诊断共用。
 * 缺销售的流量行补 0，绝不伪造指标——周报与分析页必须看到同一份口径。
 */
const importedField = (headers, aliases) => headers.find((header) => {
  const key = String(header).toLowerCase().replace(/[\s_\-]/g, '');
  return aliases.some((alias) => key === alias || key.includes(alias));
});

/** Normalize imported sales/traffic tables into the shared funnel shape. */
export function buildImportedAnalysis(tables, options = {}) {
  const manual = options.manualMapping ?? {};
  const pick = (headers, aliases, target) => (manual[target] && headers.includes(manual[target]) ? manual[target] : undefined);
  const sourceTables = Array.isArray(tables) ? tables : [];
  const descriptors = sourceTables.map((table) => {
    const headers = Array.isArray(table?.headers) ? table.headers : Object.keys(table?.rows?.[0] ?? {});
    return { table, headers, product: importedField(headers, ['productid', '商品id', '商品编号', '货号', 'sku']) ?? pick(headers, [], 'productId'), date: importedField(headers, ['date', '日期', '统计日期']) ?? pick(headers, [], 'date'), impressions: importedField(headers, ['impressions', '曝光量', '曝光']) ?? pick(headers, [], 'impressions'), clicks: importedField(headers, ['clicks', '点击量', '点击']) ?? pick(headers, [], 'clicks'), orders: importedField(headers, ['orders', '支付件数', '订单数', '支付数量']) ?? pick(headers, [], 'orders'), revenue: importedField(headers, ['revenue', 'salesamount', '销售额', '成交额', 'gmv']) ?? pick(headers, [], 'salesAmount'), category: importedField(headers, ['category', '品类', '类目']) ?? pick(headers, [], 'category') };
  });
  const trafficDescriptor = descriptors.find((item) => item.product && item.impressions && item.clicks);
  const salesDescriptor = descriptors.find((item) => item.product && (item.orders || item.revenue));
  if (!trafficDescriptor && !salesDescriptor) return { rows: [], reason: '至少需要包含商品 ID，以及曝光/点击或支付/销售额字段。' };
  const normalize = (descriptor, row) => ({
    date: descriptor.date ? row[descriptor.date] : undefined,
    productId: descriptor.product ? String(row[descriptor.product] ?? '').trim() : '',
    category: descriptor.category ? String(row[descriptor.category] ?? '').trim() || '未分类' : '未分类',
    impressions: descriptor.impressions ? number(row[descriptor.impressions]) : 0,
    clicks: descriptor.clicks ? number(row[descriptor.clicks]) : 0,
    orders: descriptor.orders ? number(row[descriptor.orders]) : 0,
    revenue: descriptor.revenue ? number(row[descriptor.revenue]) : 0,
  });
  const trafficRows = trafficDescriptor ? (trafficDescriptor.table.rows ?? []).map((row) => normalize(trafficDescriptor, row)).filter((row) => row.productId) : [];
  const salesRows = salesDescriptor ? (salesDescriptor.table.rows ?? []).map((row) => normalize(salesDescriptor, row)).filter((row) => row.productId) : [];
  const rows = trafficRows.length ? aggregateTrafficWithSales(trafficRows, salesRows) : salesRows.map((row) => ({ ...row, paid: row.orders, salesAmount: row.revenue }));
  return { rows, reason: rows.length ? '' : '导入表中没有可分析的数据行。' };
}

export function aggregateTrafficWithSales(trafficRows, salesRows, options = {}) {
  const traffic = Array.isArray(trafficRows) ? trafficRows : [];
  const sales = Array.isArray(salesRows) ? salesRows : [];
  const dateKey = options.dateKey ?? 'date';
  const useDate = traffic.some((row) => row?.[dateKey] !== undefined)
    && sales.some((row) => row?.[dateKey] !== undefined);
  const makeKey = (row) => useDate ? String(row?.productId ?? '') + '|' + String(row?.[dateKey] ?? '') : String(row?.productId ?? '');
  const salesByKey = new Map();
  for (const row of sales) {
    const key = makeKey(row);
    const current = salesByKey.get(key) ?? { paid: 0, addToCart: 0, salesAmount: 0 };
    current.paid += number(row?.orders);
    current.addToCart += number(row?.addToCart);
    current.salesAmount += number(row?.revenue);
    salesByKey.set(key, current);
  }
  return traffic.map((row) => {
    const summary = salesByKey.get(makeKey(row));
    return { ...row, paid: summary?.paid ?? 0, addToCart: summary?.addToCart ?? 0, salesAmount: summary?.salesAmount ?? 0 };
  });
}

/** 今日概览：最近数据日环比 + 异常 Top3 + 今日到期/逾期任务数。 */
export function buildTodayBrief({ trend = [], diagnostics = [], tasks = [], now = new Date(), compareMode = 'prev' } = {}) {
  const series = (Array.isArray(trend) ? trend : []).filter((point) => point?.date != null && point.date !== '');
  const last = series[series.length - 1] ?? null;
  let prev = series[series.length - 2] ?? null;
  if (compareMode === 'lastWeekSame' && last?.date) {
    const base = new Date(last.date + 'T12:00:00');
    base.setDate(base.getDate() - 7);
    const pad = (v) => String(v).padStart(2, '0');
    const target = base.getFullYear() + '-' + pad(base.getMonth() + 1) + '-' + pad(base.getDate());
    prev = series.find((point) => point.date === target) ?? null;
  }
  const changePct = last && prev && Number(prev.value) > 0
    ? Math.round(((Number(last.value) - Number(prev.value)) / Number(prev.value)) * 1000) / 10
    : null;
  const priorityRank = { 高: 0, 中: 1, 低: 2 };
  const topIssues = (Array.isArray(diagnostics) ? diagnostics : [])
    .filter((item) => item?.status !== '已解决')
    .sort((a, b) => (priorityRank[a?.priority] ?? 3) - (priorityRank[b?.priority] ?? 3))
    .slice(0, 3)
    .map((item) => ({ finding: String(item.finding ?? ''), priority: item.priority ?? '中' }));
  const pad = (value) => String(value).padStart(2, '0');
  const todayStr = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const openTasks = (Array.isArray(tasks) ? tasks : []).filter((task) => task?.status !== '已完成' && task?.status !== '已取消');
  return {
    date: last?.date ?? null,
    yesterdayValue: last ? Number(last.value) : null,
    changePct,
    topIssues,
    dueToday: openTasks.filter((task) => task.dueDate === todayStr).length,
    overdue: openTasks.filter((task) => task.dueDate && task.dueDate < todayStr).length,
    staleDays: daysSinceLastImport(series, now),
  };
}

/** 数据健康度：距最近一次导入过去多少天（0=昨天有数据；null=无数据）。 */
export function daysSinceLastImport(trend, now = new Date()) {
  const series = (Array.isArray(trend) ? trend : []).filter((point) => point?.date);
  if (series.length === 0) return null;
  const lastMs = Date.parse(String(series[series.length - 1].date) + 'T12:00:00');
  if (!Number.isFinite(lastMs)) return null;
  return Math.max(0, Math.floor((now.getTime() - lastMs) / (24 * 60 * 60 * 1000)) - 1);
}
