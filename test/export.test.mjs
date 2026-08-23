import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWordBlob,
  buildWorkbookSheets,
  canDownload,
  preflightReport,
  renderMarkdownFragment,
  renderReportHtml,
} from '../src/lib/export/index.js';

const baseDraft = {
  period: '2026-08-18 至 2026-08-24',
  modules: [
    { id: 'overview', kind: 'text', title: '报告概览', visible: true, text: '第 34 周商品经营分析', period: '2026-08-18 至 2026-08-24' },
    { id: 'diagnostics', kind: 'diagnostics', title: '策略诊断', visible: true, diagnostics: [{
      id: 'd1', finding: 'SKU-1004 触发高曝光低点击规则', priority: '高', evidence: '曝光 34,800，点击率 1.01%',
      hypothesis: { text: '主图或卖点可能需要调整', isAiAssisted: true }, suggestedAction: '人工核对标题与主图' }] },
    { id: 'next-actions', kind: 'text', title: '下一步动作', visible: true, text: '补充供应商库存反馈' },
  ],
};

test('preflightReport passes a complete draft; AI notices never block readiness', () => {
  const result = preflightReport(baseDraft, { now: '2026-08-23T00:00:00.000Z' });
  assert.equal(result.ready, true);
  // AI 辅助假设仅提示（notice），不阻断导出
  assert.deepEqual(result.warnings.map((item) => item.code), ['ai-unconfirmed']);
  assert.equal(result.warnings[0].severity, 'notice');
  assert.equal(result.checkedAt, '2026-08-23T00:00:00.000Z');
});

test('preflightReport flags missing period, unconfirmed AI hypotheses, and empty modules', () => {
  const draft = {
    period: '未配置',
    modules: [
      { id: 'overview', kind: 'text', title: '报告概览', visible: true, text: '标题', period: '未配置' },
      { id: 'diagnostics', kind: 'diagnostics', title: '策略诊断', visible: true, diagnostics: [{ finding: 'X 触发规则', hypothesis: { text: '假设', isAiAssisted: true } }] },
      { id: 'next-actions', kind: 'text', title: '下一步动作', visible: true, text: '待补充' },
    ],
  };
  const result = preflightReport(draft);
  assert.equal(result.ready, false);
  const codes = result.warnings.map((item) => item.code);
  assert.ok(codes.includes('period-missing'));
  assert.ok(codes.includes('ai-unconfirmed'));
  assert.ok(codes.includes('empty-module'));
});

test('preflightReport ignores hidden modules when checking emptiness', () => {
  const draft = { period: '第 34 周', modules: [
    { id: 'next-actions', kind: 'text', title: '下一步动作', visible: false, text: '' },
  ] };
  const result = preflightReport(draft);
  assert.equal(result.ready, true);
});

test('renderMarkdownFragment converts headings, lists, bold, quotes and escapes HTML', () => {
  const fragment = renderMarkdownFragment('# 标题\n## 小节\n### 条目\n- **重点**内容\n> 提示文字');
  assert.ok(fragment.includes('<h1>标题</h1>'));
  assert.ok(fragment.includes('<h2>小节</h2>'));
  assert.ok(fragment.includes('<h3>条目</h3>'));
  assert.ok(fragment.includes('<li><strong>重点</strong>内容</li>'));
  assert.ok(fragment.includes('<blockquote>提示文字</blockquote>'));

  const escaped = renderMarkdownFragment('文本 <script>alert(1)</script>');
  assert.ok(escaped.includes('&lt;script&gt;'));
  assert.ok(!escaped.includes('<script>'));
});

test('renderReportHtml embeds traceability metadata (period / rule version / generated time)', () => {
  const html = renderReportHtml({ markdown: '# 周报', period: '2026-08-18 至 2026-08-24', ruleVersion: 'builtin-rules v0.1', generatedAt: '2026-08-23T01:02:03.000Z' });
  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('数据周期：</strong>2026-08-18 至 2026-08-24'));
  assert.ok(html.includes('规则版本：</strong>builtin-rules v0.1'));
  assert.ok(html.includes('生成时间：</strong>2026-08-23T01:02:03.000Z'));
  assert.ok(html.includes('<h1>周报</h1>'));
});

test('renderReportHtml escapes the document title', () => {
  const html = renderReportHtml({ markdown: '', title: '<img src=x onerror=alert(1)> 周报' });
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; 周报'));
});

test('buildWordBlob strips the outer HTML shell and produces an msword payload', () => {
  const html = renderReportHtml({ markdown: '# 周报', period: '第 34 周' });
  const blob = buildWordBlob(html);
  assert.equal(blob.type, 'application/msword;charset=utf-8');
  assert.ok(blob.size > 0);
});

test('buildWorkbookSheets lays out overview, diagnostics and text sheets plus extras', () => {
  const sheets = buildWorkbookSheets(baseDraft, [
    { name: '透视结果', rows: [{ 品类: '上装', 销售额: 1280 }] },
  ]);
  assert.deepEqual(sheets.map((sheet) => sheet.name), ['报告概览', '策略诊断', '下一步动作', '透视结果']);
  assert.equal(sheets[0].rows[0].数据周期, '2026-08-18 至 2026-08-24');
  assert.equal(sheets[1].rows[0]['AI辅助假设'], '是（需人工验证）');
  assert.equal(sheets[3].rows[0].品类, '上装');
});

test('buildWorkbookSheets tolerates an empty draft and empty extras', () => {
  const sheets = buildWorkbookSheets({}, []);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, '报告概览');
});

test('download helpers stay inert outside the browser', () => {
  assert.equal(canDownload(), false);
});