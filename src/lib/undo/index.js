/**
 * PRD §18 状态与错误恢复 — tiny immutable undo/redo history.
 * Pure and UI-agnostic: React binding lives in useEditHistory.js.
 * Original data is never touched; only derived drafts flow through here.
 */

export const DEFAULT_HISTORY_LIMIT = 50;

const clonePresent = (value) => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);

/** Start a fresh history around the initial present (defensively cloned). */
export function createHistory(present, options = {}) {
  return {
    past: [],
    present: clonePresent(present),
    presentLabel: '',
    future: [],
    limit: Math.max(1, Number(options.limit ?? DEFAULT_HISTORY_LIMIT)),
  };
}

/** Commit a new present: archives the old one and invalidates the redo stack. */
export function pushHistory(history, present, label = '') {
  const archived = { present: clonePresent(history.present), label: history.presentLabel };
  return {
    past: [...history.past, archived].slice(-history.limit),
    present,
    presentLabel: label,
    future: [],
    limit: history.limit,
  };
}

export function canUndo(history) {
  return history.past.length > 0;
}

export function canRedo(history) {
  return history.future.length > 0;
}

export function undoHistory(history) {
  if (!canUndo(history)) return history;
  const previous = history.past[history.past.length - 1];
  return {
    ...history,
    past: history.past.slice(0, -1),
    present: previous.present,
    presentLabel: previous.label,
    future: [{ present: clonePresent(history.present), label: history.presentLabel }, ...history.future].slice(0, history.limit),
  };
}

export function redoHistory(history) {
  if (!canRedo(history)) return history;
  const [next, ...rest] = history.future;
  return {
    ...history,
    past: [...history.past, { present: clonePresent(history.present), label: history.presentLabel }].slice(-history.limit),
    present: next.present,
    presentLabel: next.label,
    future: rest,
  };
}

/** Human-readable summary of what the next undo would revert to. */
export function describeUndo(history) {
  if (!canUndo(history)) return null;
  // 撤销的是「当前动作」，所以展示当前节点的操作标签
  return history.presentLabel || '上一步';
}

export function describeRedo(history) {
  if (!canRedo(history)) return null;
  const next = history.future[0];
  return next.label || '下一步';
}
