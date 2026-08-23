import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReportDraft,
  reorderReportModules,
  setReportModuleVisibility,
  updateReportText,
  renderReportMarkdown,
  downloadMarkdownReport,
} from '../src/features/report/index.js';

test('creates an editable report draft with ordered visible modules', () => {
  const draft = createReportDraft({
    title: '第 35 周商品分析',
    period: '2026-08-24 至 2026-08-30',
    diagnostics: [{ finding: 'SKU-1 点击率偏低', priority: '高', evidence: '点击率 1.2%', hypothesis: { text: '标题卖点不清晰', isAiAssisted: true } }],
  });

  assert.deepEqual(draft.modules.map((module) => module.id), ['overview', 'diagnostics', 'next-actions']);
  assert.ok(draft.modules.every((module) => module.visible === true));
  assert.equal(draft.modules.find((module) => module.id === 'overview').text, '第 35 周商品分析');
});

test('reorders modules without dropping modules omitted from the requested order', () => {
  const draft = createReportDraft({ title: '报告' });
  const reordered = reorderReportModules(draft, ['next-actions', 'overview']);
  assert.deepEqual(reordered.modules.map((module) => module.id), ['next-actions', 'overview', 'diagnostics']);
  assert.deepEqual(draft.modules.map((module) => module.id), ['overview', 'diagnostics', 'next-actions']);
});

test('toggles visibility and edits text immutably', () => {
  const draft = createReportDraft({ title: '报告', nextActions: '检查标题' });
  const hidden = setReportModuleVisibility(draft, 'diagnostics', false);
  const edited = updateReportText(hidden, 'next-actions', '本周优先检查标题与主图。');

  assert.equal(edited.modules.find((module) => module.id === 'diagnostics').visible, false);
  assert.equal(edited.modules.find((module) => module.id === 'next-actions').text, '本周优先检查标题与主图。');
  assert.equal(draft.modules.find((module) => module.id === 'diagnostics').visible, true);
  assert.equal(draft.modules.find((module) => module.id === 'next-actions').text, '检查标题');
});

test('renders visible modules as markdown and clearly labels AI-assisted hypotheses', () => {
  const draft = createReportDraft({
    title: '第 35 周商品分析',
    period: '本周',
    diagnostics: [{ finding: 'SKU-1 点击率偏低', priority: '高', evidence: '点击率 1.2%', hypothesis: { text: '标题卖点不清晰', isAiAssisted: true } }],
    nextActions: '人工复核前 5 个商品。',
  });
  const markdown = renderReportMarkdown(setReportModuleVisibility(draft, 'overview', true));

  assert.match(markdown, /第 35 周商品分析/);
  assert.match(markdown, /标题卖点不清晰/);
  assert.match(markdown, /AI 辅助假设/);
  assert.match(markdown, /人工复核前 5 个商品/);

  const hidden = renderReportMarkdown(setReportModuleVisibility(draft, 'diagnostics', false));
  assert.doesNotMatch(hidden, /SKU-1 点击率偏低/);
});

test('downloads markdown with a safe .md filename in a browser environment', () => {
  const originalDocument = globalThis.document;
  const originalURL = globalThis.URL;
  const anchor = { clickCalled: false, click() { this.clickCalled = true; } };
  const revoked = [];
  globalThis.document = { createElement: () => anchor };
  globalThis.URL = {
    createObjectURL: () => 'blob:report',
    revokeObjectURL: (url) => revoked.push(url),
  };

  try {
    assert.equal(downloadMarkdownReport('# 报告', '第35周'), true);
    assert.equal(anchor.download, '第35周.md');
    assert.equal(anchor.href, 'blob:report');
    assert.equal(anchor.clickCalled, true);
    assert.deepEqual(revoked, ['blob:report']);
  } finally {
    globalThis.document = originalDocument;
    globalThis.URL = originalURL;
  }
});
