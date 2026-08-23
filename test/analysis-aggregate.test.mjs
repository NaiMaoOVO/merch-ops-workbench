import test from 'node:test';
import assert from 'node:assert/strict';

import { aggregateTrafficWithSales } from '../src/lib/analysis/index.js';

test('aggregateTrafficWithSales uses real sales totals and fills missing products with zero', () => {
  const traffic = [
    { productId: 'A', impressions: 100 },
    { productId: 'B', impressions: 200 },
  ];
  const sales = [
    { productId: 'A', orders: 3, addToCart: 5, revenue: 45.5 },
    { productId: 'A', orders: 2, addToCart: 1, revenue: 20 },
  ];
  assert.deepEqual(aggregateTrafficWithSales(traffic, sales), [
    { productId: 'A', impressions: 100, paid: 5, addToCart: 6, salesAmount: 65.5 },
    { productId: 'B', impressions: 200, paid: 0, addToCart: 0, salesAmount: 0 },
  ]);
});

test('aggregateTrafficWithSales tolerates empty or malformed inputs without inventing rows', () => {
  assert.deepEqual(aggregateTrafficWithSales([], []), []);
  assert.deepEqual(aggregateTrafficWithSales([{ productId: 'A' }], null), [{ productId: 'A', paid: 0, addToCart: 0, salesAmount: 0 }]);
  assert.deepEqual(aggregateTrafficWithSales(null, [{ productId: 'A', orders: 1 }]), []);
});

test('aggregateTrafficWithSales joins by product and date when both tables provide dates', () => {
  const traffic = [
    { date: '2026-08-23', productId: 'A', impressions: 100 },
    { date: '2026-08-24', productId: 'A', impressions: 200 },
  ];
  const sales = [
    { date: '2026-08-23', productId: 'A', orders: 2, revenue: 20 },
    { date: '2026-08-24', productId: 'A', orders: 5, revenue: 50 },
  ];
  assert.deepEqual(aggregateTrafficWithSales(traffic, sales).map((row) => [row.date, row.paid, row.salesAmount]), [
    ['2026-08-23', 2, 20],
    ['2026-08-24', 5, 50],
  ]);
});
