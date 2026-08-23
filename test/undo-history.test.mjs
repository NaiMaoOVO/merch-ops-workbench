import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canRedo,
  canUndo,
  createHistory,
  describeRedo,
  describeUndo,
  pushHistory,
  redoHistory,
  undoHistory,
} from '../src/lib/undo/index.js';

test('pushHistory archives the previous present and clears the redo stack', () => {
  let history = createHistory({ text: 'v1' });
  history = pushHistory(history, { text: 'v2' }, '编辑文字');
  history = pushHistory(history, { text: 'v3' }, '移动模块');
  assert.equal(history.present.text, 'v3');
  assert.deepEqual(history.past.map((item) => item.present.text), ['v1', 'v2']);
  assert.equal(history.presentLabel, '移动模块');
});

test('undo then redo round-trips through the same states', () => {
  let history = createHistory({ step: 1 });
  history = pushHistory(history, { step: 2 }, '第二步');
  history = pushHistory(history, { step: 3 }, '第三步');

  history = undoHistory(history);
  assert.equal(history.present.step, 2);
  assert.ok(canRedo(history));
  history = undoHistory(history);
  assert.equal(history.present.step, 1);

  history = redoHistory(history);
  assert.equal(history.present.step, 2);
  history = redoHistory(history);
  assert.equal(history.present.step, 3);
  assert.ok(!canRedo(history));
});

test('a new commit after undo discards the redo branch', () => {
  let history = createHistory('a');
  history = pushHistory(history, 'b', '改成b');
  history = pushHistory(history, 'c', '改成c');
  history = undoHistory(history);
  history = pushHistory(history, 'd', '改成d');
  assert.ok(!canRedo(history));
  assert.deepEqual(history.past.map((item) => item.present), ['a', 'b']);
});

test('undo and redo at the boundaries are no-ops', () => {
  let history = createHistory('only');
  assert.ok(!canUndo(history));
  assert.equal(describeUndo(history), null);
  assert.equal(undoHistory(history), history);
  assert.equal(redoHistory(history), history);
  assert.equal(describeRedo(history), null);
});

test('history limit keeps only the most recent snapshots', () => {
  let history = createHistory(0, { limit: 3 });
  for (let value = 1; value <= 6; value += 1) history = pushHistory(history, value, 'v' + value);
  assert.equal(history.past.length, 3);
  assert.deepEqual(history.past.map((item) => item.present), [3, 4, 5]);
});

test('archived snapshots are cloned so later mutations cannot leak into history', () => {
  const draft = { modules: [{ id: 'm1' }] };
  let history = createHistory(draft);
  draft.modules[0].id = 'mutated'; // 外部原地修改不应影响已归档快照
  history = pushHistory(history, { modules: [{ id: 'm2' }] }, '编辑');
  assert.equal(history.past[0].present.modules[0].id, 'm1');
  assert.equal(describeUndo(history), '编辑');
});