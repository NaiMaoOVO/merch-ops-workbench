import React, { useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import {
  buildChatEndpoint,
  buildTitleCandidatesRequest,
  callChatCompletion,
  parseTitleCandidates,
  readSavedSettings,
} from '../../lib/ai/index.js';
import { validateAiConfig } from '../settings/index.js';
import {
  bulkUpdateReviewStatus,
  createTitleItems,
  diffTitleWords,
  getApprovedTitles,
  updateReviewStatus,
  validateTitle,
} from './index.js';
import './title-workspace.css';

const statusOptions = ['待审核', '已通过', '已拒绝', '待修改'];

export function TitleWorkspace({ rows = [], products = [], onExport }) {
  const [language, setLanguage] = useState('both');
  const [items, setItems] = useState(() => createTitleItems(rows, { language: 'both', count: 2 }));
  const [bannedWords, setBannedWords] = useState('waterproof, guarantee');
  const [filter, setFilter] = useState('all');
  // PRD §9.2 + §16.3：AI 候选先预览脱敏载荷，手动放行后才请求；结果一律进入「待审核」。
  const [aiState, setAiState] = useState({ status: 'idle', message: '', preview: null, request: null });

  function prepareAiCandidates() {
    const settings = readSavedSettings();
    const config = settings.ai;
    const check = validateAiConfig(config ?? {});
    if (!check.valid) {
      setAiState({ status: 'unconfigured', message: '尚未配置可用的 AI 接口（' + check.errors.join('；') + '）。本地模板生成不受影响。', preview: null, request: null });
      return;
    }
    const request = buildTitleCandidatesRequest(rows, {
      language,
      bannedWords: bannedWords.split(/[,，、]/).map((word) => word.trim()).filter(Boolean),
      hideProductId: (settings.sensitiveFields ?? []).includes('商品 ID'),
    });
    setAiState({
      status: 'preview',
      message: '',
      request,
      preview: {
        endpoint: buildChatEndpoint(config.baseUrl),
        model: config.model,
        fields: request.preview.fields.join('、'),
        rowCount: request.preview.rowCount,
        hidden: request.preview.productColumnHidden,
        rows: request.maskedRows.slice(0, 2),
      },
    });
  }

  async function confirmAiCandidates() {
    if (aiState.status !== 'preview' || !aiState.request) return;
    setAiState({ ...aiState, status: 'loading' });
    try {
      const config = readSavedSettings().ai ?? {};
      const reply = await callChatCompletion(config, { messages: aiState.request.messages, maxTokens: 900, timeoutMs: 40000 });
      const candidates = parseTitleCandidates(reply, { aliasMap: aiState.request.preview.aliasMap });
      setItems((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...candidates.filter((candidate) => !known.has(candidate.id))];
      });
      setAiState({ status: 'done', message: 'AI 返回 ' + candidates.length + ' 条候选，已加入列表并标记为「AI 辅助」，请逐条人工审核。', preview: null, request: null });
    } catch (error) {
      setAiState({ status: 'error', message: error.message + '（可重试；本地模板生成不受影响）', preview: null, request: null });
    }
  }

  const productById = useMemo(() => new Map(products.map((product) => [product.productId, product])), [products]);
  const visibleItems = items.filter((item) => filter === 'all' || item.reviewStatus === filter);
  const approved = getApprovedTitles(items);

  function regenerate() {
    const source = rows.map((row) => ({ ...productById.get(row.productId), ...row }));
    setItems(createTitleItems(source, { language, count: 2 }));
  }

  function review(id, reviewStatus) {
    setItems((current) => updateReviewStatus(current, id, reviewStatus));
  }

  // 批量审核：只作用于显式勾选的候选，保持人工确认前提（PRD §9.2）。
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelect = (id) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const bulkReview = (status) => {
    if (!selectedIds.length) return;
    setItems((current) => bulkUpdateReviewStatus(current, selectedIds, status));
    setSelectedIds([]);
  };

  function exportApproved() {
    const payload = approved.map((item) => ({
      productId: item.productId,
      language: item.language,
      title: item.text,
      reviewStatus: item.reviewStatus,
    }));
    if (onExport) onExport(payload);
    else navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
  }

  return (
    <section className="title-workspace" aria-label="标题优化工作区">
      <div className="title-workspace__toolbar">
        <label className="title-workspace__field">
          生成语言
          <select value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="both">中文 + English</option>
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
        </label>
        <label className="title-workspace__field">
          禁用词（逗号分隔）
          <input value={bannedWords} onChange={(event) => setBannedWords(event.target.value)} />
        </label>
        <button type="button" className="title-workspace__button" onClick={regenerate}>重新生成</button>
        <button type="button" className="title-workspace__button" onClick={prepareAiCandidates} disabled={aiState.status === 'loading'}><Sparkles size={13} /> AI 候选</button>
        <button type="button" className="title-workspace__button title-workspace__button--secondary" onClick={exportApproved} disabled={!approved.length}>
          导出已通过 ({approved.length})
        </button>
        <label className="title-workspace__field">
          筛选状态
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">全部</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <span className="title-workspace__bulk">
          已选 {selectedIds.length} 项
          <button type="button" className="title-workspace__button" onClick={() => bulkReview('已通过')} disabled={!selectedIds.length}>通过所选</button>
          <button type="button" className="title-workspace__button title-workspace__button--secondary" onClick={() => bulkReview('已拒绝')} disabled={!selectedIds.length}>退回所选</button>
        </span>
      </div>
      {aiState.status === 'unconfigured' && <p className="title-workspace__empty" role="status">{aiState.message}</p>}
      {aiState.status === 'preview' && (
        <div role="status" data-testid="title-ai-preview" style={{ margin: '10px 0', border: '1px solid var(--line)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,.72)' }}>
          <div style={{ fontSize: 12 }}>目标接口：<code>{aiState.preview.endpoint}</code> · 模型 <code>{aiState.preview.model}</code></div>
          <div style={{ fontSize: 12, marginTop: 4 }}>发送字段：{aiState.preview.fields}（共 {aiState.preview.rowCount} 行{aiState.preview.hidden ? '；商品 ID 已按隐私设置隐藏' : '；商品 ID 已匿名化'}）</div>
          <pre style={{ margin: '8px 0', maxHeight: 140, overflow: 'auto', fontSize: 11, whiteSpace: 'pre-wrap' }}>{JSON.stringify(aiState.preview.rows, null, 2)}</pre>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="title-workspace__button" onClick={confirmAiCandidates}>确认发送</button>
            <button type="button" className="title-workspace__button title-workspace__button--secondary" onClick={() => setAiState({ status: 'idle', message: '', preview: null, request: null })}>取消</button>
          </div>
        </div>
      )}
      {(aiState.status === 'loading' || aiState.status === 'done' || aiState.status === 'error') && (
        <p className="title-workspace__empty" role="status">{aiState.status === 'loading' ? '正在请求 AI 候选…' : aiState.message}</p>
      )}
      <div className="title-workspace__list">
        {visibleItems.length === 0 ? <div className="title-workspace__empty">暂无标题候选，请先导入标题样例。</div> : visibleItems.map((item) => {
          const product = productById.get(item.productId) ?? rows.find((row) => row.productId === item.productId) ?? {};
          const validation = validateTitle(item, product, { bannedWords });
          return (
            <article className="title-workspace__item" key={item.id}>
              <label className="title-workspace__pick">
                <input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleSelect(item.id)} aria-label={`选择 ${item.productId} 候选`} />
              </label>
              <div>
                <div className="title-workspace__meta">
                  <span>{item.productId}</span>
                  <span className="title-workspace__badge">{item.language === 'zh' ? '中文' : 'English'}</span>
                  <span className="title-workspace__badge">{item.reviewStatus}</span>
                  {item.generatedBy === 'ai-assisted' && <span className="title-workspace__badge" title="AI 生成，需人工审核">AI 辅助</span>}
                </div>
                <p className="title-workspace__original">原标题：{rows.find((row) => row.productId === item.productId)?.originalTitle ?? '未提供'}</p>
                <p className="title-workspace__candidate">
                  {(() => { const originalTitle = rows.find((row) => row.productId === item.productId)?.originalTitle; if (!originalTitle) return item.text;
                    return diffTitleWords(originalTitle, item.text).map((token, index) => token.isNew
                      ? <mark key={index} className="title-workspace__diff-new" title="原标题没有的新增词">{token.word}</mark>
                      : <span key={index}>{' ' + token.word}</span>); })()}
                </p>
                <div className="title-workspace__checks">
                  {Object.entries(validation.checks).map(([name, check]) => <span className="title-workspace__badge" key={name}>{name}: {check.valid ? '通过' : '需检查'}</span>)}
                </div>
              </div>
              <div className="title-workspace__actions">
                <select aria-label={`${item.id} 审核状态`} value={item.reviewStatus} onChange={(event) => review(item.id, event.target.value)}>
                  {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default TitleWorkspace;
