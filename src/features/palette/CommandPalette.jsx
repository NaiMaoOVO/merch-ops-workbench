import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';

/**
 * ⌘K / Ctrl+K 命令面板：全局跳转与搜索。
 * items: [{ id, label, hint?, action }]；键盘 ↑↓ 选择、Enter 执行、Esc 关闭。
 */
export default function CommandPalette({ open, onClose, items = [] }) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => !q || item.label.toLowerCase().includes(q) || String(item.keywords ?? '').toLowerCase().includes(q));
  }, [items, query]);

  if (!open) return null;

  const runItem = (item) => { onClose(); item.action?.(); };
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setIndex((current) => Math.min(current + 1, filtered.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setIndex((current) => Math.max(current - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); runItem(filtered[index]); }
    else if (event.key === 'Escape') { event.preventDefault(); onClose(); }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="命令面板" onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(40,20,30,.35)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: '12vh' }}>
      <div className="glass-card" onClick={(event) => event.stopPropagation()} style={{ width: 'min(560px, 92vw)', padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="搜索页面、任务、异常…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14 }}
          />
        </div>
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, maxHeight: '46vh', overflowY: 'auto' }}>
          {filtered.length === 0 && <li style={{ padding: '10px 8px', color: '#96707f', fontSize: 13 }}>没有匹配结果</li>}
          {filtered.map((item, i) => (
            <li key={item.id}>
              <button
                onClick={() => runItem(item)}
                onMouseEnter={() => setIndex(i)}
                style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 10, border: 'none', background: i === index ? 'rgba(179,101,135,.14)' : 'transparent', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'baseline' }}
              >
                <strong style={{ fontSize: 13 }}>{item.label}</strong>
                {item.hint && <small style={{ color: '#96707f' }}>{item.hint}</small>}
              </button>
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 6, fontSize: 11, color: '#96707f', textAlign: 'right' }}>↑↓ 选择 · Enter 确认 · Esc 关闭</div>
      </div>
    </div>
  );
}
