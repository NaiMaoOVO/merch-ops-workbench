import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the workbench shell exposes the dashboard entry and primary navigation', () => {
  const app = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  assert.match(app, /今日工作驾驶舱/);
  assert.match(app, /商品数据分析/);
  assert.match(app, /供应商问题/);
  assert.match(app, /教程与帮助/);
});
