import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSparklinePoints } from '../src/lib/analysis/sparkline.js';

test('buildSparklinePoints 输出归一化坐标且首尾贴边', () => {
  const points = buildSparklinePoints([0, 5, 10], { width: 100, height: 20 });
  const pairs = points.split(' ').map((pair) => pair.split(',').map(Number));
  assert.equal(pairs.length, 3);
  assert.equal(pairs[0][0], 2);
  assert.equal(pairs[2][0], 98);
  assert.ok(Math.abs(pairs[2][1] - 2) < 0.01, '最大值应贴近顶部');
});

test('空序列与非有限值被安全处理', () => {
  assert.equal(buildSparklinePoints([]), '');
  assert.equal(buildSparklinePoints([3]), '');
  const points = buildSparklinePoints([1, NaN, 2]);
  assert.equal(points.split(' ').length, 2);
});
