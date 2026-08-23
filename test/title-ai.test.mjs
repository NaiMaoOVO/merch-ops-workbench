import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTitleCandidatesRequest,
  parseTitleCandidates,
  readSavedSettings,
} from '../src/lib/ai/index.js';

const products = [
  { productId: 'SKU-1001', categoryZh: '上装', facts: ['ribbed', 'square neck'], keywords: ['knit top'], originalTitle: 'Women Top' },
  { productId: 'SKU-1002', categoryZh: '下装', facts: ['wide leg'], keywords: ['cargo pants'], originalTitle: 'Cargo Pants' },
];

test('buildTitleCandidatesRequest pseudonymises ids and lists preview fields', () => {
  const request = buildTitleCandidatesRequest(products, { language: 'both', bannedWords: ['waterproof'] });
  assert.deepEqual(request.preview.fields, ['商品ID', '品类', '卖点与关键词', '原标题']);
  assert.equal(request.maskedRows[0].商品ID, 'SKU-1');
  assert.equal(request.preview.aliasMap['SKU-1'], 'SKU-1001');
  assert.ok(request.messages[1].content.includes('禁用词：waterproof'));
  assert.ok(!JSON.stringify(request.maskedRows).includes('SKU-1001')); // 真实 ID 不出本地
});

test('buildTitleCandidatesRequest can hide the product column entirely', () => {
  const request = buildTitleCandidatesRequest(products, { hideProductId: true });
  assert.equal(request.preview.productColumnHidden, true);
  assert.ok(!request.preview.fields.includes('商品ID'));
  assert.equal(request.preview.aliasMap, null);
});

test('buildTitleCandidatesRequest preserves string facts and keywords from imported rows', () => {
  const request = buildTitleCandidatesRequest([{ productId: 'SKU-7', facts: '缎面; 蝴蝶结', keywords: '发夹, 配饰' }]);
  assert.equal(request.maskedRows[0].卖点与关键词, '缎面、蝴蝶结、发夹、配饰');
});

test('parseTitleCandidates reads fenced or bare JSON and restores real product ids', () => {
  const aliasMap = { 'SKU-1': 'SKU-1001' };
  const fenced = '好的，以下是候选：\n\n```json\n[{"id":"SKU-1","language":"en","text":"Ribbed Square Neck Knit Top"},{"id":"SKU-1","language":"zh","text":"罗纹方领针织上衣"}]\n```';
  const items = parseTitleCandidates(fenced, { aliasMap });
  assert.equal(items.length, 2);
  assert.equal(items[0].productId, 'SKU-1001');
  assert.equal(items[0].generatedBy, 'ai-assisted');
  assert.equal(items[0].reviewStatus, '待审核');
  assert.equal(items[1].id, 'SKU-1001-zh-ai-1');

  const bare = parseTitleCandidates('[{"id":"SKU-1","text":"Plain Top"}]', { aliasMap });
  assert.equal(bare[0].language, 'en'); // 缺省语言按 en 处理
});

test('parseTitleCandidates caps candidates per product and rejects garbage', () => {
  const many = Array.from({ length: 5 }, (_, index) => ({ id: 'SKU-9', language: 'en', text: 'T' + index }));
  assert.equal(parseTitleCandidates(JSON.stringify(many), { maxPerProduct: 3 }).length, 3);

  assert.throws(() => parseTitleCandidates('这不是 JSON'), /不是有效的 JSON/);
  assert.throws(() => parseTitleCandidates('{"a":1}'), /不是 JSON 数组/);
  assert.throws(() => parseTitleCandidates('[{"id":"x","text":"  "}'), /不是有效的 JSON|未返回可用标题/);
});

test('readSavedSettings tolerates missing or broken storage payloads', () => {
  assert.deepEqual(readSavedSettings(null), {});
  assert.deepEqual(readSavedSettings({ getItem: () => null }), {});
  const broken = { getItem: () => '{oops' };
  assert.deepEqual(readSavedSettings(broken), {});
  const good = { getItem: () => JSON.stringify({ ai: { provider: 'deepseek' } }) };
  assert.equal(readSavedSettings(good).ai.provider, 'deepseek');
});