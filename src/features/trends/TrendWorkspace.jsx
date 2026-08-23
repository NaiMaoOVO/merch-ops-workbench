import { useMemo, useState } from 'react';
import { ExternalLink, FileImage, Filter, Link2, Plus, Search, Sparkles, Upload } from 'lucide-react';
import {
  HEAT_LEVELS,
  SOURCE_CREDIBILITIES,
  TREND_STATUSES,
  createTrendNote,
  filterTrendNotes,
  sortTrendNotes,
  summarizeTrendNotes,
  updateTrendNote,
} from './index.js';
import './trends-workspace.css';

const emptyDraft = {
  keyword: '', categoryId: '', productIds: [], sourcePlatform: '', sourceUrl: '', attachmentNote: '',
  discoveredDate: new Date().toISOString().slice(0, 10), heatLevel: '中', sourceCredibility: '中', status: '待验证', observation: '', nextAction: '',
};

function labelForProduct(products, productId) {
  const product = products.find((item) => item.productId === productId);
  return product?.productName ? `${productId} · ${product.productName}` : productId;
}

export default function TrendWorkspace({ rows = [], products = [], categories = [], onChange }) {
  const [notes, setNotes] = useState(() => rows.map((row) => createTrendNote(row, { id: row.noteId })));
  const [filters, setFilters] = useState({ query: '', heatLevel: '', sourceCredibility: '', status: '', categoryId: '', productId: '' });
  const [draft, setDraft] = useState(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const summary = useMemo(() => summarizeTrendNotes(notes), [notes]);
  const visibleNotes = useMemo(() => sortTrendNotes(filterTrendNotes(notes, filters)), [notes, filters]);

  function commit(next) {
    setNotes(next);
    onChange?.(next);
  }

  function submit(event) {
    event.preventDefault();
    if (!draft.keyword.trim()) return;
    const note = createTrendNote(draft);
    commit([note, ...notes]);
    setDraft(emptyDraft);
    setShowForm(false);
  }

  function edit(noteId, patch) {
    commit(updateTrendNote(notes, noteId, patch));
  }

  function toggleProduct(productId) {
    setDraft((current) => ({ ...current, productIds: current.productIds.includes(productId) ? current.productIds.filter((id) => id !== productId) : [...current.productIds, productId] }));
  }

  return (
    <main className="trends-workspace" data-testid="trends-workspace">
      <header className="trends-workspace__header">
        <div>
          <p className="trends-workspace__eyebrow"><Sparkles size={14} /> 市场观察 · 选品记录</p>
          <h1>把零散热点，变成可验证的商品方向。</h1>
          <p className="trends-workspace__intro">手动记录关键词、来源和观察结论，再关联商品或品类，方便回看和转化。</p>
        </div>
        <div className="trends-workspace__actions">
          <button type="button" className="trends-button trends-button--secondary" onClick={() => setShowSources((value) => !value)}><Link2 size={15} />数据源配置</button>
          <button type="button" className="trends-button trends-button--primary" onClick={() => setShowForm((value) => !value)}><Plus size={16} />新增观察</button>
        </div>
      </header>

      <div className="trends-workspace__summary" aria-label="热点概览">
        <div><span>全部记录</span><strong>{summary.total}</strong></div>
        <div><span>活跃观察</span><strong>{summary.active}</strong></div>
        <div className="is-hot"><span>高热度</span><strong>{summary.highHeat}</strong></div>
        <div><span>已验证</span><strong>{summary.verified}</strong></div>
        <div><span>高可信来源</span><strong>{summary.highCredibility}</strong></div>
      </div>

      {showSources && <section className="trends-placeholder" aria-label="外部数据源配置"><strong>外部数据源接口（预留）</strong><p>后续可配置平台、授权状态、请求频率和字段标准化。目前建议使用手动记录或文件导入，避免未经确认的外部抓取。</p><button type="button" className="trends-button trends-button--secondary" onClick={() => setShowSources(false)}>知道了</button></section>}

      {showForm && (
        <form className="trends-form" onSubmit={submit}>
          <div className="trends-form__grid">
            <label>热点关键词<input autoFocus required value={draft.keyword} onChange={(event) => setDraft({ ...draft, keyword: event.target.value })} placeholder="例如：satin bow" /></label>
            <label>发现日期<input type="date" value={draft.discoveredDate} onChange={(event) => setDraft({ ...draft, discoveredDate: event.target.value })} /></label>
            <label>来源平台<input value={draft.sourcePlatform} onChange={(event) => setDraft({ ...draft, sourcePlatform: event.target.value })} placeholder="例如：TikTok、竞品观察" /></label>
            <label>关联品类<select value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">暂不关联</option>{categories.map((category) => <option value={category.categoryId} key={category.categoryId}>{category.categoryNameZh ?? category.categoryNameEn ?? category.categoryId}</option>)}</select></label>
            <label>热度判断<select value={draft.heatLevel} onChange={(event) => setDraft({ ...draft, heatLevel: event.target.value })}>{HEAT_LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label>
            <label>来源可信度<select value={draft.sourceCredibility} onChange={(event) => setDraft({ ...draft, sourceCredibility: event.target.value })}>{SOURCE_CREDIBILITIES.map((level) => <option key={level}>{level}</option>)}</select></label>
          </div>
          <label>来源链接<input type="url" value={draft.sourceUrl} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://..." /></label>
          <label>截图或附件备注<textarea rows="2" value={draft.attachmentNote} onChange={(event) => setDraft({ ...draft, attachmentNote: event.target.value })} placeholder="记录截图位置、文件名或其他证据" /></label>
          <label>观察结论<textarea rows="2" value={draft.observation} onChange={(event) => setDraft({ ...draft, observation: event.target.value })} placeholder="这个热点可能对应什么卖点？" /></label>
          <label>下一步动作<textarea rows="2" value={draft.nextAction} onChange={(event) => setDraft({ ...draft, nextAction: event.target.value })} placeholder="例如：关联 3 款商品，检查标题关键词" /></label>
          <div className="trends-form__products"><span>关联商品（可多选）</span><div>{products.map((product) => <label className="trends-check" key={product.productId}><input type="checkbox" checked={draft.productIds.includes(product.productId)} onChange={() => toggleProduct(product.productId)} />{labelForProduct(products, product.productId)}</label>)}</div></div>
          <div className="trends-form__footer"><button type="submit" className="trends-button trends-button--primary">保存观察</button><button type="button" className="trends-button trends-button--secondary" onClick={() => setShowForm(false)}>取消</button></div>
        </form>
      )}

      <section className="trends-panel">
        <div className="trends-toolbar">
          <label className="trends-search"><Search size={16} /><input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="搜索关键词、来源或观察结论" aria-label="搜索热点" /></label>
          <select aria-label="按热度筛选" value={filters.heatLevel} onChange={(event) => setFilters({ ...filters, heatLevel: event.target.value })}><option value="">全部热度</option>{HEAT_LEVELS.map((level) => <option key={level}>{level}</option>)}</select>
          <select aria-label="按状态筛选" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">全部状态</option>{TREND_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
          <select aria-label="按品类筛选" value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="">全部品类</option>{categories.map((category) => <option value={category.categoryId} key={category.categoryId}>{category.categoryNameZh ?? category.categoryNameEn ?? category.categoryId}</option>)}</select>
          <button type="button" className="trends-icon-button" title="更多筛选" onClick={() => setFilters({ ...filters, sourceCredibility: filters.sourceCredibility ? '' : '高' })}><Filter size={16} />{filters.sourceCredibility ? '高可信' : '筛选'}</button>
          <button type="button" className="trends-import-button" onClick={() => setShowImport((value) => !value)}><Upload size={15} />导入表格</button>
        </div>
        {showImport && <div className="trends-import-note"><FileImage size={17} /><span>支持 Excel/CSV 导入的接口已预留。当前可先使用示例数据或手动新增，接入真实表格时会提供字段映射和预览。</span><button type="button" onClick={() => setShowImport(false)}>关闭</button></div>}
        <div className="trends-list" aria-live="polite">
          {visibleNotes.length ? visibleNotes.map((note) => <article className="trend-card" key={note.noteId}>
            <div className="trend-card__main">
              <div className="trend-card__meta"><span>{note.noteId}</span><span>{note.discoveredDate}</span><span className={`trend-pill trend-pill--${note.heatLevel}`}>热度 {note.heatLevel}</span><span>来源可信度 {note.sourceCredibility}</span></div>
              <input className="trend-card__keyword" aria-label={`${note.noteId} 关键词`} value={note.keyword} onChange={(event) => edit(note.noteId, { keyword: event.target.value })} />
              <textarea className="trend-card__observation" aria-label={`${note.noteId} 观察结论`} rows="2" value={note.observation} onChange={(event) => edit(note.noteId, { observation: event.target.value })} placeholder="补充观察结论" />
              <div className="trend-card__chips">{note.categoryIds?.map((categoryId) => <span key={categoryId}>品类：{categoryId}</span>)}{note.productIds?.map((productId) => <span key={productId}>商品：{productId}</span>)}</div>
              {note.nextAction && <p className="trend-card__action">下一步：{note.nextAction}</p>}
              {note.attachmentNote && <p className="trend-card__attachment"><FileImage size={14} />{note.attachmentNote}</p>}
            </div>
            <div className="trend-card__side">
              <select aria-label={`${note.noteId} 状态`} value={note.status} onChange={(event) => edit(note.noteId, { status: event.target.value })}>{TREND_STATUSES.map((status) => <option key={status}>{status}</option>)}</select>
              <select aria-label={`${note.noteId} 来源可信度`} value={note.sourceCredibility} onChange={(event) => edit(note.noteId, { sourceCredibility: event.target.value })}>{SOURCE_CREDIBILITIES.map((level) => <option key={level}>{level}</option>)}</select>
              {note.sourceUrl ? <a className="trend-card__source" href={note.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />查看来源</a> : <span className="trend-card__source is-empty">未添加来源链接</span>}
            </div>
          </article>) : <div className="trends-empty">当前筛选下没有热点记录，先新增一条观察吧。</div>}
        </div>
      </section>
    </main>
  );
}

export { labelForProduct };
