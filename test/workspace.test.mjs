import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarkdownReport, loadProject, saveProject } from '../src/lib/workspace/index.js';

test('workspace persistence round-trips a project without throwing', () => {
  const storage = new Map();
  const adapter = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const project = { id: 'week-34', name: '第 34 周商品分析', updatedAt: '2026-08-24', selectedTables: ['sales', 'traffic'] };
  saveProject(project, adapter);
  assert.deepEqual(loadProject(project.id, adapter), project);
});

test('buildMarkdownReport includes evidence and AI hypothesis labels', () => {
  const markdown = buildMarkdownReport({ title: '第 34 周商品分析', period: '2026-08-17 至 2026-08-24', diagnostics: [{ finding: 'SKU-1004 高曝光低点击', priority: '高', evidence: '曝光 65,800，点击率 1.2%', hypothesis: '标题卖点可能不够清晰' }] });
  assert.match(markdown, /第 34 周商品分析/);
  assert.match(markdown, /证据/);
  assert.match(markdown, /辅助假设/);
});
