import test from 'node:test';
import assert from 'node:assert/strict';

import { compareProjects } from '../src/features/history/index.js';

test('compareProjects returns formatted fields and change markers', () => {
  const result = compareProjects(
    { id: 'w33', name: '第 33 周', period: '8 月 11–17 日', site: 'US', progress: 1, selectedTables: ['sales'], updatedAt: '2026-08-17T10:20:00.000Z' },
    { id: 'w34', name: '第 34 周', period: '8 月 18–24 日', site: 'US', progress: 0.5, selectedTables: ['sales', 'traffic'], updatedAt: '2026-08-24T10:20:00.000Z' },
  );
  assert.equal(result.left.name, '第 33 周');
  assert.equal(result.right.name, '第 34 周');
  assert.equal(result.rows.find((row) => row.key === 'progress').left, '100%');
  assert.equal(result.rows.find((row) => row.key === 'progress').right, '50%');
  assert.equal(result.rows.find((row) => row.key === 'progress').changed, true);
  assert.equal(result.rows.find((row) => row.key === 'site').changed, false);
  assert.equal(result.rows.find((row) => row.key === 'selectedTables').right, '2');
});

test('compareProjects rejects missing projects', () => {
  assert.throws(() => compareProjects(null, { id: 'w34' }), /两个可用项目/);
});
