import { useMemo, useState } from 'react';
import { buildChatEndpoint, buildWeeklyDigestRequest, callChatCompletion, parseWeeklyDigest, readSavedSettings } from '../../lib/ai/index.js';
import { buildLocalDigest } from '../../lib/analysis/local-digest.js';
import { validateAiConfig } from '../settings/index.js';
import { ChevronDown, ChevronUp, Download, Eye, EyeOff, FileCode2, FileSpreadsheet, FileType2, Printer, Redo2, ShieldCheck, Sparkles, Undo2 } from 'lucide-react';
import { useEditHistory } from '../../lib/undo/useEditHistory.js';
import {
  buildReportTemplate,
  createReportDraft,
  downloadMarkdownReport,
  loadReportTemplates,
  renderReportMarkdown,
  reorderReportModules,
  REPORT_TEMPLATES_KEY,
  saveReportTemplates,
  setReportModuleVisibility,
  updateReportText,
} from './index.js';
import {
  buildWorkbookSheets,
  downloadText,
  exportReportWorkbook,
  exportWordDocument,
  preflightReport,
  printReportHtml,
  renderReportHtml,
} from '../../lib/export/index.js';

function moveModule(draft, moduleId, direction) {
  const ids = draft.modules.map((module) => module.id);
  const index = ids.indexOf(moduleId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return draft;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  return reorderReportModules(draft, ids);
}

function DiagnosticPreview({ diagnostics = [] }) {
  if (!diagnostics.length) return <p className="panel-help">暂无已确认诊断。</p>;
  return (
    <div className="diagnostic-list">
      {diagnostics.map((item) => (
        <article className="diagnostic-row" key={item.id}>
          <div className="diagnostic-top">
            <strong>{item.finding}</strong>
            <span className="priority-tag">{item.priority}</span>
          </div>
          <p>证据：{item.evidence}</p>
          <small>
            {item.hypothesis.isAiAssisted && <span className="ai-badge"><Sparkles size={12} />AI 辅助假设</span>}
            {item.hypothesis.text}（需人工验证）
          </small>
        </article>
      ))}
    </div>
  );
}

const EXPORT_BUTTON_STYLE = { display: 'inline-flex', alignItems: 'center', gap: 6 };

export default function ReportWorkspace({ report, onChange }) {
  // PRD §18：报告编辑保存处理步骤，支持撤销/重做；草稿自动保存到本机并在下次打开时恢复。
  const reportDraftKey = 'merch-workbench:report-draft:' + String(report?.id ?? report?.period ?? 'default');
  const { value: draft, commit: commitHistory, undo, redo, canUndo, canRedo, restoredDraft, clearDraft, reset } = useEditHistory(createReportDraft(report), { storageKey: reportDraftKey });
  const [check, setCheck] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [aiDigest, setAiDigest] = useState({ status: 'idle', request: null, preview: null });
  const fillLocalDigest = () => {
    const text = buildLocalDigest({ totals: report?.totals, comparison: report?.comparison, diagnostics: report?.diagnostics ?? [], annotations: report?.annotations ?? {}, period: draft.period });
    if (!text) { setStatusMessage('暂无分析数据可填充，请先在商品数据分析页导入并运行分析。'); return; }
    const module = { id: 'local-digest', kind: 'text', title: '数据摘要（本地生成）', visible: true, text };
    const modules = draft.modules.some((item) => item.id === module.id) ? draft.modules.map((item) => item.id === module.id ? { ...item, ...module } : item) : [...draft.modules, module];
    commit({ ...draft, modules }, '一键填充数据摘要');
    setStatusMessage('已用本地规则填充数据摘要，可直接编辑微调。');
  };
  const prepareAiDigest = () => {
    const settings = readSavedSettings();
    const config = settings.ai ?? {};
    const checkConfig = validateAiConfig(config);
    if (!checkConfig.valid) { setAiDigest({ status: 'error', request: null, preview: null }); setStatusMessage('尚未配置可用的 AI 接口：' + checkConfig.errors.join('；')); return; }
    const request = buildWeeklyDigestRequest({ totals: report?.totals, comparison: report?.comparison, annotations: report?.annotations, period: draft.period });
    setAiDigest({ status: 'preview', request, preview: { endpoint: buildChatEndpoint(config.baseUrl), model: config.model, fields: request.preview.fields.join('、'), sensitiveFieldsExcluded: true } });
    setStatusMessage('AI 摘要请求已生成，请确认脱敏预览后发送。');
  };
  const confirmAiDigest = async () => {
    if (aiDigest.status !== 'preview' || !aiDigest.request) return;
    setAiDigest((current) => ({ ...current, status: 'loading' }));
    try {
      const config = readSavedSettings().ai ?? {};
      const reply = await callChatCompletion(config, { messages: aiDigest.request.messages, maxTokens: 320, timeoutMs: 40000 });
      const text = parseWeeklyDigest(reply);
      const module = { id: 'ai-digest', kind: 'text', title: 'AI 执行摘要（待审核）', visible: true, text };
      const modules = draft.modules.some((item) => item.id === module.id) ? draft.modules.map((item) => item.id === module.id ? { ...item, ...module } : item) : [...draft.modules, module];
      commit({ ...draft, modules }, '生成 AI 执行摘要');
      setAiDigest({ status: 'done', request: null, preview: null });
      setStatusMessage('AI 执行摘要已加入报告，内容仍需人工审核。');
    } catch (error) { setAiDigest({ status: 'error', request: null, preview: null }); setStatusMessage('AI 摘要失败：' + error.message); }
  };
  const [templates, setTemplates] = useState(() => loadReportTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const persistTemplates = (list) => { saveReportTemplates(null, list); setTemplates(loadReportTemplates()); };
  const saveAsTemplate = () => {
    const name = window.prompt('模板名称：', '我的周报结构');
    if (!name) return;
    try {
      const template = buildReportTemplate(name, draft.modules);
      persistTemplates([...loadReportTemplates(), template]);
      setSelectedTemplateId(template.id);
      setStatusMessage('已保存模板「' + name + '」，任意报告都可套用。');
    } catch (error) { setStatusMessage('保存失败：' + error.message); }
  };
  const applySelectedTemplate = () => {
    const tpl = templates.find((item) => item.id === selectedTemplateId);
    if (!tpl) { setStatusMessage('请先在下拉框选择一个模板。'); return; }
    commit({ ...draft, modules: JSON.parse(JSON.stringify(tpl.modules)) }, '套用模板 ' + tpl.name);
    setStatusMessage('已套用模板「' + tpl.name + '」。');
  };
  const deleteSelectedTemplate = () => {
    const tpl = templates.find((item) => item.id === selectedTemplateId);
    if (!tpl || !window.confirm('删除模板「' + tpl.name + '」？')) return;
    persistTemplates(templates.filter((item) => item.id !== selectedTemplateId));
    setSelectedTemplateId('');
    setStatusMessage('已删除模板「' + tpl.name + '」。');
  };
  const markdown = useMemo(() => renderReportMarkdown(draft), [draft]);
  const html = useMemo(() => renderReportHtml({ markdown, period: draft.period }), [markdown, draft.period]);
  const commit = (next, label) => { commitHistory(next, label); onChange?.(next); };

  // PRD §13.3：导出前运行完整性检查，标记未确认 AI 建议、缺失周期和空模块。
  const guardExport = (action) => {
    const result = preflightReport(draft);
    setCheck(result);
    setStatusMessage('');
    action(result);
  };

  const EXPORT_FORMAT_KEY = 'merch-workbench:prefs';
  const rememberExportFormat = (format) => { try { const prefs = JSON.parse(window.localStorage.getItem(EXPORT_FORMAT_KEY) ?? '{}'); window.localStorage.setItem(EXPORT_FORMAT_KEY, JSON.stringify({ ...prefs, lastExport: format })); } catch {} };
  const [lastExport, setLastExport] = useState(() => { try { return JSON.parse(window.localStorage.getItem('merch-workbench:prefs') ?? '{}').lastExport ?? ''; } catch { return ''; } });

  function exportExcel() {
    guardExport(async () => {
      try {
        const downloaded = await exportReportWorkbook(buildWorkbookSheets(draft));
        if (downloaded) { rememberExportFormat('Excel'); setLastExport('Excel'); }
        setStatusMessage(downloaded ? 'Excel 已开始下载。' : '当前环境不支持下载，请在浏览器中使用。');
      } catch (error) {
        setStatusMessage('Excel 导出失败：' + error.message);
      }
    });
  }

  function printPdf() {
    guardExport(() => {
      const opened = printReportHtml(html);
      if (opened) { rememberExportFormat('PDF'); setLastExport('PDF'); }
      setStatusMessage(opened ? '已打开打印窗口：选择"另存为 PDF"即可归档。' : '浏览器拦截了弹窗，请允许弹出窗口后重试。');
    });
  }

  return (
    <main className="analysis-workspace" data-testid="report-workspace">
      <section className="workspace-hero glass-card">
        <div>
          <span className="eyebrow">REPORT STUDIO · 模块化报告</span>
          <h1>周报与报告</h1>
          <p>编辑模块、确认 AI 辅助假设，再按需要导出 Markdown、HTML、Word、Excel 或 PDF。{lastExport && <small style={{ color: '#96707f', marginLeft: 6 }}>上次导出：{lastExport}</small>}</p>
        </div>
        <div className="workspace-actions" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="primary-button" style={EXPORT_BUTTON_STYLE} onClick={() => { rememberExportFormat('Markdown'); setLastExport('Markdown'); downloadMarkdownReport(markdown); }}><Download size={15} />Markdown</button>
          <button className="secondary-button" style={EXPORT_BUTTON_STYLE} onClick={() => guardExport(() => downloadText(html, '商品经营分析报告.html', 'text/html;charset=utf-8'))}><FileCode2 size={15} />HTML</button>
          <button className="secondary-button" style={EXPORT_BUTTON_STYLE} onClick={() => guardExport(() => exportWordDocument(html))}><FileType2 size={15} />Word</button>
          <button className="secondary-button" style={EXPORT_BUTTON_STYLE} onClick={exportExcel}><FileSpreadsheet size={15} />Excel</button>
          <button className="secondary-button" style={EXPORT_BUTTON_STYLE} onClick={printPdf}><Printer size={15} />打印 / PDF</button>
        </div>
      </section>

      {aiDigest.preview && (
        <section className="notice-box glass-card" role="status" data-testid="ai-digest-preview">
          <ShieldCheck size={16} />
          <div><strong>AI 执行摘要发送预览</strong><small style={{ display: 'block', marginTop: 4 }}>接口：{aiDigest.preview.endpoint} · 模型：{aiDigest.preview.model} · 字段：{aiDigest.preview.fields} · 不发送原始明细</small></div>
        </section>
      )}

      {check && (
        <section className="notice-box glass-card" role="status" data-testid="report-preflight" style={{ alignItems: 'flex-start' }}>
          <ShieldCheck size={16} />
          <div>
            <strong>{check.ready ? '完整性检查通过（' + check.warnings.length + ' 条提示）' : '发现 ' + check.warnings.filter((item) => item.severity !== 'info').length + ' 个需要处理的问题'}</strong>
            {check.warnings.length > 0 && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 12, lineHeight: 1.7 }}>
                {check.warnings.map((item) => <li key={item.code + item.message}>{item.message}</li>)}
              </ul>
            )}
            {statusMessage && <small style={{ display: 'block', marginTop: 4 }}>{statusMessage}</small>}
          </div>
        </section>
      )}

      <div className="analysis-grid">
        <section className="panel-card glass-card" data-tutorial="report-editor">
          <div className="panel-heading">
            <div><span className="section-kicker">EDIT</span><h2>报告模块</h2></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button className="icon-button" aria-label="撤销上一步" title={canUndo ? '撤销' : '没有可撤销的步骤'} disabled={!canUndo} onClick={undo} data-testid="report-undo"><Undo2 size={15} /></button>
              <button className="icon-button" aria-label="重做" title={canRedo ? '重做' : '没有可重做的步骤'} disabled={!canRedo} onClick={redo} data-testid="report-redo"><Redo2 size={15} /></button>
              <button className="text-button" onClick={saveAsTemplate}>存为模板</button>
              <button className="text-button" onClick={fillLocalDigest}>填充数据摘要</button>
              <button className="text-button" onClick={prepareAiDigest}><Sparkles size={14} />AI 执行摘要</button>
              {aiDigest.status === 'preview' && <button className="text-button" onClick={confirmAiDigest}>确认发送脱敏数据</button>}
              <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} aria-label="选择报告模板" style={{ maxWidth: 150 }}>
                <option value="">套用模板…</option>
                {templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {selectedTemplateId && <button className="text-button" onClick={applySelectedTemplate}>应用</button>}
              {selectedTemplateId && <button className="text-button" onClick={deleteSelectedTemplate}>删除</button>}
              <span className="soft-status">可编辑草稿</span>
            </div>
          </div>
          <p className="panel-help">模块只影响报告展示，不会修改原始分析数据。隐藏模块不会出现在 Markdown 导出中。</p>
          {restoredDraft && (
            <p className="panel-help" data-testid="draft-restored" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              已自动恢复上次未完成的草稿。
              <button
                className="text-button"
                onClick={() => { reset(createReportDraft(report)); clearDraft(); }}
              >丢弃草稿并重置</button>
            </p>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {draft.modules.map((module, index) => (
              <article className="diagnostic-row" key={module.id}>
                <div className="diagnostic-top">
                  <strong>{module.title}</strong>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="icon-button" aria-label={`上移${module.title}`} disabled={index === 0} onClick={() => commit(moveModule(draft, module.id, -1), '移动模块')}><ChevronUp size={15} /></button>
                    <button className="icon-button" aria-label={`下移${module.title}`} disabled={index === draft.modules.length - 1} onClick={() => commit(moveModule(draft, module.id, 1), '移动模块')}><ChevronDown size={15} /></button>
                    <button className="icon-button" aria-label={`${module.visible ? '隐藏' : '显示'}${module.title}`} onClick={() => commit(setReportModuleVisibility(draft, module.id, !module.visible), module.visible ? '隐藏模块' : '显示模块')}>{module.visible ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                  </div>
                </div>
                {!module.visible && <small className="panel-help">已隐藏，不会导出</small>}
                {module.kind === 'text' && (
                  <textarea
                    aria-label={`编辑${module.title}`}
                    value={module.text}
                    onChange={(event) => { const text = event.target.value; commitHistory((current) => updateReportText(current, module.id, text), '编辑文字', 'text:' + module.id); }}
                    rows={module.id === 'overview' ? 2 : 4}
                    style={{ width: '100%', marginTop: 10, border: '1px solid var(--line)', borderRadius: 10, padding: 9, background: 'rgba(255,255,255,.72)', resize: 'vertical' }}
                  />
                )}
                {module.kind === 'diagnostics' && <DiagnosticPreview diagnostics={module.diagnostics} />}
              </article>
            ))}
          </div>
        </section>

        <section className="panel-card glass-card" data-tutorial="report-preview">
          <div className="panel-heading">
            <div><span className="section-kicker">PREVIEW</span><h2>Markdown 预览</h2></div>
            <span className="soft-status success">实时更新</span>
          </div>
          <p className="panel-help">预览内容可复制到飞书、企业微信、Notion 或普通文档。AI 内容已明确标注为待验证假设。</p>
          <pre style={{ margin: 0, minHeight: 390, maxHeight: 580, overflow: 'auto', padding: 14, whiteSpace: 'pre-wrap', borderRadius: 14, background: 'rgba(250,247,251,.78)', color: '#5f4d59', fontSize: 11, lineHeight: 1.65 }}>{markdown}</pre>
        </section>
      </div>
    </main>
  );
}

export { createReportDraft, renderReportMarkdown } from './index.js';
