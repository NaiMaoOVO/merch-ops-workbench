import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAnomalyHypothesisRequest,
  buildChatEndpoint,
  callChatCompletion,
  extractAssistantText,
  maskRows,
  pseudonymizeValues,
  testConnection,
} from '../src/lib/ai/index.js';

const config = { baseUrl: 'https://api.example.com/v1', model: 'demo-model', apiKey: 'sk-test' };

function stubFetch(responseBody, { status = 200, capture = [] } = {}) {
  return async (url, init) => {
    capture.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(responseBody),
    };
  };
}

test('buildChatEndpoint normalises base urls without duplicating the path', () => {
  assert.equal(buildChatEndpoint('https://api.x.com/v1/'), 'https://api.x.com/v1/chat/completions');
  assert.equal(buildChatEndpoint('https://api.x.com'), 'https://api.x.com/chat/completions');
  assert.equal(buildChatEndpoint('https://api.x.com/v1/chat/completions'), 'https://api.x.com/v1/chat/completions');
  assert.throws(() => buildChatEndpoint('   '), /接口地址不能为空/);
});

test('extractAssistantText reads choices and reports API errors explicitly', () => {
  assert.equal(extractAssistantText({ choices: [{ message: { content: ' 假设内容 ' } }] }), '假设内容');
  assert.throws(() => extractAssistantText({ error: { message: '余额不足' } }), /余额不足/);
  assert.throws(() => extractAssistantText({}), /无法识别/);
});

test('callChatCompletion posts OpenAI-style body with bearer auth', async () => {
  const capture = [];
  const fetchImpl = stubFetch({ choices: [{ message: { content: '辅助假设：主图需要优化' } }] }, { capture });
  const reply = await callChatCompletion(config, { messages: [{ role: 'user', content: 'hi' }], maxTokens: 120, fetchImpl, timeoutMs: 5000 });

  assert.equal(reply, '辅助假设：主图需要优化');
  const { url, init } = capture[0];
  assert.equal(url, 'https://api.example.com/v1/chat/completions');
  assert.equal(init.method, 'POST');
  assert.equal(init.headers.Authorization, 'Bearer sk-test');
  const body = JSON.parse(init.body);
  assert.equal(body.model, 'demo-model');
  assert.equal(body.max_tokens, 120);
  assert.deepEqual(body.messages, [{ role: 'user', content: 'hi' }]);
});

test('callChatCompletion surfaces HTTP errors with server detail', async () => {
  const fetchImpl = stubFetch({ error: { message: 'invalid api key' } }, { status: 401 });
  await assert.rejects(
    () => callChatCompletion(config, { messages: [{ role: 'user', content: 'hi' }], fetchImpl }),
    /401.*invalid api key/s,
  );
});

test('callChatCompletion wraps network failures in a friendly message', async () => {
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  await assert.rejects(
    () => callChatCompletion(config, { messages: [{ role: 'user', content: 'hi' }], fetchImpl }),
    /网络请求失败：ECONNREFUSED/,
  );
});

test('testConnection returns ok with endpoint or a structured failure', async () => {
  const good = await testConnection(config, { fetchImpl: stubFetch({ choices: [{ message: { content: 'OK' } }] }) });
  assert.equal(good.ok, true);
  assert.equal(good.endpoint, 'https://api.example.com/v1/chat/completions');
  assert.equal(good.reply, 'OK');

  const bad = await testConnection({ ...config, baseUrl: 'not-a-url' });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /接口地址/);
});

test('pseudonymizeValues keeps stable aliases per distinct value', () => {
  assert.deepEqual(pseudonymizeValues(['A', 'B', 'A', ''], 'SKU'), ['SKU-1', 'SKU-2', 'SKU-1', 'SKU-3']);
});

test('maskRows drops masked columns (space-insensitive) and pseudonymises ids', () => {
  const rows = [
    { 商品ID: 'SKU-1', 供应商名称: '广州棉语服饰', 曝光量: 100 },
    { 商品ID: 'SKU-2', 供应商名称: '东莞简作供应链', 曝光量: 200 },
    { 商品ID: 'SKU-1', 供应商名称: '广州棉语服饰', 曝光量: 300 },
  ];
  const masked = maskRows(rows, {
    maskedFields: ['供应商名称'],
    pseudonymizedFields: [{ column: '商品 ID', prefix: 'SKU' }],
  });
  assert.deepEqual(Object.keys(masked[0]), ['商品ID', '曝光量']);
  assert.deepEqual(masked.map((row) => row.商品ID), ['SKU-1', 'SKU-2', 'SKU-1']);
});

test('buildAnomalyHypothesisRequest hides the product column when configured', () => {
  const anomalies = [
    { productId: 'SKU-1004', impressions: 34800, clickRate: 0.0101, conversionRate: 0.09, rule: 'high-impression-low-click' },
  ];

  const pseudonymised = buildAnomalyHypothesisRequest(anomalies, { hideProductId: false });
  assert.deepEqual(pseudonymised.preview.fields, ['商品ID', '曝光量', '点击率', '支付转化率', '规则']);
  assert.equal(pseudonymised.maskedRows[0].商品ID, 'SKU-1');
  assert.ok(pseudonymised.messages[0].content.includes('辅助假设'));

  const hidden = buildAnomalyHypothesisRequest(anomalies, { hideProductId: true });
  assert.equal(hidden.preview.productColumnHidden, true);
  assert.ok(!hidden.preview.fields.includes('商品ID'));
  assert.deepEqual(hidden.maskedRows[0], { 曝光量: 34800, 点击率: '1.01%', 支付转化率: '9.00%', 规则: '高曝光低点击' });
});