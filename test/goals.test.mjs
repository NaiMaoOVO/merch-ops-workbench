import test from 'node:test';
import assert from 'node:assert/strict';
import { getMonthlyTarget, monthProgress, setMonthlyTarget } from '../src/lib/goals/index.js';

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
  };
}

test('monthProgress 聚合当月数据并计算比率', () => {
  const result = monthProgress({
    trend: [{ date: '2026-08-01', value: 400 }, { date: '2026-08-15', value: 350 }, { date: '2026-07-30', value: 9999 }],
    target: 1000,
    monthKey: '2026-08',
  });
  assert.equal(result.monthSales, 750);
  assert.equal(result.ratio, 0.75);
  assert.equal(result.remain, 250);
  assert.equal(result.done, false);
});

test('达标判定与零目标安全处理', () => {
  assert.equal(monthProgress({ trend: [{ date: '2026-08-01', value: 1200 }], target: 1000, monthKey: '2026-08' }).done, true);
  assert.equal(monthProgress({ trend: [], target: 0, monthKey: '2026-08' }).ratio, null);
});

test('目标的存取与清零', () => {
  const storage = createMemoryStorage();
  assert.equal(getMonthlyTarget(storage, 'p1'), 0);
  setMonthlyTarget(storage, 'p1', 5000);
  assert.equal(getMonthlyTarget(storage, 'p1'), 5000);
  setMonthlyTarget(storage, 'p1', 0);
  assert.equal(getMonthlyTarget(storage, 'p1'), 0);
});
