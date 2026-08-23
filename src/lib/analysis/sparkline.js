/** 把数值序列转换为 SVG polyline 的 points 字符串；空序列返回空串。 */
export function buildSparklinePoints(values, { width = 240, height = 48, padding = 2 } = {}) {
  const series = (Array.isArray(values) ? values : []).map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (series.length < 2) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return series.map((value, index) => {
    const x = padding + (innerW * index) / (series.length - 1);
    const y = padding + innerH - (innerH * (value - min)) / span;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
