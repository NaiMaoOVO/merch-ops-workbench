import test from 'node:test';
import assert from 'node:assert/strict';

import { chainJoins, matchTables } from '../src/lib/data/index.js';

const sales = [
  { date: '2026-08-24', productId: 'SKU-1', orders: 10, revenue: 129 },
  { date: '2026-08-24', productId: 'SKU-2', orders: 4, revenue: 99.96 },
  { date: '2026-08-24', productId: 'SKU-9', orders: 2, revenue: 20 }, // 无商品档案
];
const products = [
  { productId: 'SKU-1', productName: 'Ribbed Top', categoryId: 'CAT-TOP', supplierId: 'SUP-01' },
  { productId: 'SKU-2', productName: 'Cargo Pants', categoryId: 'CAT-BTM', supplierId: 'SUP-02' },
];
const categories = [
  { categoryId: 'CAT-TOP', categoryNameZh: '上装' },
  { categoryId: 'CAT-BTM', categoryNameZh: '下装' },
];
const suppliers = [
  { supplierId: 'SUP-01', supplierName: '广州棉语服饰' },
  { supplierId: 'SUP-02', supplierName: '东莞简作供应链' },
];

test('chainJoins runs consecutive left joins and reports each step (PRD §8.4)', () => {
  const result = chainJoins(sales, [
    { table: products, key: 'productId', label: '销售 → 商品', columns: ['productName', 'categoryId', 'supplierId'] },
    { table: categories, key: 'categoryId', label: '商品 → 品类', columns: ['categoryNameZh'] },
    { table: suppliers, key: 'supplierId', label: '商品 → 供应商', columns: ['supplierName'] },
  ]);

  assert.equal(result.rows.length, 3);
  assert.deepEqual(result.reports.map((report) => report.label), ['销售 → 商品', '商品 → 品类', '商品 → 供应商']);

  const topRow = result.rows.find((row) => row.productId === 'SKU-1');
  assert.equal(topRow.categoryNameZh, '上装');
  assert.equal(topRow.supplierName, '广州棉语服饰');

  // 未匹配主键一路保留原始行
  const orphan = result.rows.find((row) => row.productId === 'SKU-9');
  assert.equal(orphan.productName, undefined);
  assert.equal(orphan.revenue, 20);
});

test('chainJoins records unmatched keys and step numbering per report', () => {
  const result = chainJoins(sales, [
    { table: products, key: 'productId' },
    { table: categories, key: 'categoryId' },
  ]);
  assert.equal(result.reports[0].step, 1);
  assert.deepEqual(result.reports[0].unmatchedPrimaryKeys, ['SKU-9']);
  assert.equal(result.reports[1].step, 2);
  assert.deepEqual(result.reports[1].unmatchedPrimaryKeys, []); // SKU-9 行没有 categoryId，跳过匹配
});

test('chainJoins keeps only requested columns to avoid name conflicts', () => {
  const wide = chainJoins([{ productId: 'SKU-1', productName: '销售口径名' }], [
    { table: products, key: 'productId' }, // 不选列：商品表 productName 会覆盖
  ]);
  assert.equal(wide.rows[0].productName, 'Ribbed Top');

  const narrow = chainJoins([{ productId: 'SKU-1', productName: '销售口径名' }], [
    { table: products, key: 'productId', columns: ['categoryId'] },
  ]);
  assert.equal(narrow.rows[0].productName, '销售口径名');
  assert.equal(narrow.rows[0].categoryId, 'CAT-TOP');
});

test('matchTables honours the new columns option while preserving one-to-many growth', () => {
  const duplicatedSecondary = [
    { productId: 'SKU-1', warehouse: 'A仓', stock: 5 },
    { productId: 'SKU-1', warehouse: 'B仓', stock: 8 },
  ];
  const joined = matchTables(sales.slice(0, 1), duplicatedSecondary, { primaryKey: 'productId', columns: ['stock'] });
  assert.equal(joined.report.rowCountInflation, 1);
  assert.deepEqual(joined.rows.map((row) => row.stock), [5, 8]);
  assert.equal(joined.rows[0].productName, undefined); // 未选择的列不进入结果
});

test('chainJoins with no steps returns the original rows untouched', () => {
  const result = chainJoins(sales, []);
  assert.equal(result.rows, sales);
  assert.deepEqual(result.reports, []);
});