/** 从分析摘要生成本地报告文字草稿（不依赖 AI），供一键填充使用。 */
export function buildLocalDigest({ totals = {}, comparison = [], diagnostics = [], annotations = {}, period = '本周期' } = {}) {
  const lines = [];
  const sales = Number(totals.salesAmount) || 0;
  const impressions = Number(totals.impressions) || 0;
  const clicks = Number(totals.clicks) || 0;
  const paid = Number(totals.paid) || 0;
  if (sales > 0 || impressions > 0) {
    const clickRate = impressions > 0 ? (clicks / impressions * 100).toFixed(2) : '—';
    lines.push(`${period}：销售额 ¥${Math.round(sales).toLocaleString()}，曝光 ${impressions.toLocaleString()}，点击率 ${clickRate}%，支付 ${paid.toLocaleString()} 件。`);
  }
  const cmp = comparison.find((item) => item.metric === 'salesAmount');
  if (cmp && cmp.previous > 0) lines.push(`销售额环比：${cmp.changeLabel}（上期 ¥${cmp.previous.toLocaleString()} → 本期 ¥${cmp.current.toLocaleString()}）。`);
  const openDiag = diagnostics.filter((item) => item.status !== '已解决' && item.status !== '已忽略');
  if (openDiag.length > 0) {
    lines.push(`待处理异常 ${openDiag.length} 条，优先级分布：高 ${openDiag.filter((d) => d.priority === '高').length} / 中 ${openDiag.filter((d) => d.priority === '中').length} / 低 ${openDiag.filter((d) => d.priority === '低').length}。`);
  }
  const events = Object.entries(annotations ?? {});
  if (events.length > 0) {
    lines.push('本期事件：' + events.map(([date, label]) => `${date}（${label}）`).join('、') + '。');
  }
  return lines.join('\n');
}
