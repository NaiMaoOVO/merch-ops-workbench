/** 计算每个点的坐标（含索引，供标记点定位）；少于 2 个有效点返回空数组。 */
export function buildSparklineGeometry(values, { width = 240, height = 48, padding = 2 } = {}) {
  const indexed = (Array.isArray(values) ? values : [])
    .map((value, index) => ({ index, value: Number(value) }))
    .filter((item) => Number.isFinite(item.value));
  if (indexed.length < 2) return [];
  const series = indexed.map((item) => item.value);
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  return indexed.map((item, position) => ({
    index: item.index,
    x: +(padding + (innerW * position) / (indexed.length - 1)).toFixed(1),
    y: +(padding + innerH - (innerH * (item.value - min)) / span).toFixed(1),
  }));
}

/** 把数值序列转换为 SVG polyline 的 points 字符串；空序列返回空串。 */
export function buildSparklinePoints(values, options = {}) {
  const geometry = buildSparklineGeometry(values, options);
  if (geometry.length === 0) return '';
  return geometry.map((point) => point.x + ',' + point.y).join(' ');
}
