const toNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildPivot(rows = [], { groupBy, measures = [] } = {}) {
  if (!groupBy) return [];
  const groups = new Map();
  for (const row of rows) {
    const group = row?.[groupBy] ?? '未分类';
    const item = groups.get(group) ?? { group };
    for (const measure of measures) item[measure] = (item[measure] ?? 0) + toNumber(row?.[measure]);
    groups.set(group, item);
  }
  return [...groups.values()].map((item) => {
    if (measures.includes('impressions') && measures.includes('clicks')) item.clickRate = item.impressions ? item.clicks / item.impressions : 0;
    if (measures.includes('clicks') && measures.includes('paid')) item.conversionRate = item.clicks ? item.paid / item.clicks : 0;
    return item;
  });
}

export function buildFunnel(rows = []) {
  const totals = rows.reduce((result, row) => ({
    impressions: result.impressions + toNumber(row.impressions),
    clicks: result.clicks + toNumber(row.clicks),
    addToCart: result.addToCart + toNumber(row.addToCart),
    paid: result.paid + toNumber(row.paid),
  }), { impressions: 0, clicks: 0, addToCart: 0, paid: 0 });
  return [
    { key: 'impressions', label: '曝光', value: totals.impressions },
    { key: 'clicks', label: '点击', value: totals.clicks },
    { key: 'addToCart', label: '加购', value: totals.addToCart },
    { key: 'paid', label: '支付', value: totals.paid },
  ];
}
