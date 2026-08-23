import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
} from './index.js';

function readDraft(storage, storageKey) {
  if (!storage || !storageKey) return null;
  try {
    const raw = storage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * PRD §18：报告和标题编辑自动保存草稿。
 * - commit(updater, label, coalesceKey)：连续相同 coalesceKey 且间隔 1.2s 内的提交合并为一步，逐键输入不会塞满历史；
 * - 草稿随 present 变化写入 storage，挂载时自动恢复。
 */
export function useEditHistory(initialValue, options = {}) {
  const storage = options.storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const storageKey = options.storageKey ?? null;
  const coalesceKeyRef = useRef(null);
  const coalesceAtRef = useRef(0);
  const dirtyRef = useRef(false); // 未编辑过就不写草稿，避免下次打开误报「已恢复」

  const [history, setHistory] = useState(() => {
    const draft = readDraft(storage, storageKey);
    return createHistory(draft ?? initialValue);
  });
  const [restoredDraft, setRestoredDraft] = useState(() => readDraft(storage, storageKey) !== null);

  useEffect(() => {
    if (!storage || !storageKey || !dirtyRef.current) return;
    try { storage.setItem(storageKey, JSON.stringify(history.present)); } catch { /* 只读预览环境忽略 */ }
  }, [history.present, storage, storageKey]);

  const commit = useCallback((updater, label, coalesceKey) => {
    dirtyRef.current = true;
    setHistory((current) => {
      const nextPresent = typeof updater === 'function' ? updater(current.present) : updater;
      const now = Date.now();
      const shouldCoalesce = Boolean(coalesceKey)
        && coalesceKeyRef.current === coalesceKey
        && now - coalesceAtRef.current < 1200;
      coalesceKeyRef.current = coalesceKey || null;
      coalesceAtRef.current = now;
      if (shouldCoalesce) return { ...current, present: nextPresent, presentLabel: label || current.presentLabel };
      return pushHistory(current, nextPresent, label || '');
    });
  }, []);

  const undo = useCallback(() => {
    coalesceKeyRef.current = null;
    setHistory((current) => undoHistory(current));
  }, []);

  const redo = useCallback(() => {
    coalesceKeyRef.current = null;
    setHistory((current) => redoHistory(current));
  }, []);

  const reset = useCallback((value) => {
    coalesceKeyRef.current = null;
    dirtyRef.current = false; // 重置后视为全新内容，不再自动续写旧草稿
    setHistory(createHistory(typeof value === 'function' ? value() : value));
  }, []);

  const clearDraft = useCallback(() => {
    if (!storage || !storageKey) return;
    try { storage.removeItem(storageKey); } catch { /* 忽略 */ }
    setRestoredDraft(false);
  }, [storage, storageKey]);

  return {
    value: history.present,
    commit,
    undo,
    redo,
    reset,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    restoredDraft,
    clearDraft,
  };
}