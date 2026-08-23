import { useMemo, useRef, useState } from 'react';
import { Copy, Download, FileJson, Power, RotateCcw, Upload } from 'lucide-react';
import {
  TEMPLATE_TYPES,
  createDefaultTemplates,
  createTemplate,
  copyTemplate,
  updateTemplate,
  deactivateTemplate,
  restoreDefaultTemplate,
  filterTemplatesByType,
  getTemplateTypeLabel,
  parseTemplateBackup,
  serialiseTemplateBackup,
} from './index.js';
import './templates-workspace.css';

const FORM_DEFAULT = { type: 'field-mapping', name: '', description: '', configText: '{}' };

export default function TemplateCenter({ initialTemplates, onChange }) {
  const [templates, setTemplates] = useState(() => initialTemplates?.length ? initialTemplates : createDefaultTemplates());
  const [type, setType] = useState('all');
  const [form, setForm] = useState(FORM_DEFAULT);
  const [message, setMessage] = useState('模板用于保存字段映射、规则和报告结构，下次可直接复用。');
  const fileRef = useRef(null);
  const visibleTemplates = useMemo(() => filterTemplatesByType(templates, type, { includeInactive: true }), [templates, type]);
  const commit = (next) => { setTemplates(next); onChange?.(next); };

  function submit(event) {
    event.preventDefault();
    let config;
    try { config = JSON.parse(form.configText || '{}'); } catch { setMessage('配置必须是有效的 JSON。'); return; }
    try {
      const created = createTemplate({ ...form, config });
      commit([created, ...templates]);
      setForm(FORM_DEFAULT);
      setMessage(`已创建“${created.name}”。`);
    } catch (error) { setMessage(error.message); }
  }

  function importTemplates(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const payload = parseTemplateBackup(text);
        commit([...payload.templates, ...templates.filter((item) => !payload.templates.some((incoming) => incoming.id === item.id))]);
        setMessage(`已导入 ${payload.templates.length} 个模板。`);
      } catch (error) { setMessage(error.message); }
      event.target.value = '';
    });
  }

  function exportTemplates() {
    const blob = new Blob([serialiseTemplateBackup(templates)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'merch-workbench-templates.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('模板 JSON 已导出。');
  }

  return <main className="templates-workspace" data-testid="template-center">
    <header className="templates-hero glass-card">
      <div><span className="eyebrow"><FileJson size={14} /> TEMPLATE LIBRARY · 配置沉淀</span><h1>模板中心</h1><p>统一管理字段映射、异常规则、标题规则和报告模板，减少每周重复配置。</p></div>
      <div className="templates-actions"><button className="secondary-button" type="button" onClick={() => fileRef.current?.click()}><Upload size={15} />导入模板<input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importTemplates} /></button><button className="primary-button" type="button" onClick={exportTemplates}><Download size={15} />导出模板</button></div>
    </header>

    <section className="templates-toolbar glass-card"><div className="template-filters" role="tablist" aria-label="模板类型筛选"><button className={type === 'all' ? 'is-active' : ''} onClick={() => setType('all')}>全部</button>{TEMPLATE_TYPES.map((item) => <button className={type === item ? 'is-active' : ''} key={item} onClick={() => setType(item)}>{getTemplateTypeLabel(item)}</button>)}</div><span className="templates-count">{visibleTemplates.filter((item) => item.active !== false).length} 个启用模板</span></section>

    <section className="templates-create glass-card"><div><span className="section-kicker">CREATE</span><h2>新建模板</h2><p className="panel-help">配置以 JSON 保存，适合从简单字段开始逐步沉淀自己的工作方法。</p></div><form className="templates-form" onSubmit={submit}><label>模板类型<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{TEMPLATE_TYPES.map((item) => <option key={item} value={item}>{getTemplateTypeLabel(item)}</option>)}</select></label><label>模板名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：女装周报模板" required /></label><label>说明<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="使用场景和注意事项" /></label><label className="templates-config">配置 JSON<textarea rows="2" value={form.configText} onChange={(event) => setForm({ ...form, configText: event.target.value })} /></label><button type="submit" className="primary-button">创建模板</button></form></section>

    <p className="templates-message" role="status">{message}</p>
    <section className="templates-grid">{visibleTemplates.length === 0 ? <div className="templates-empty glass-card">暂无模板，可以新建一个。</div> : visibleTemplates.map((template) => <article className={`template-card glass-card ${template.active === false ? 'is-inactive' : ''}`} key={template.id}><div className="template-card__top"><span className="template-type">{getTemplateTypeLabel(template.type)}</span>{template.isDefault && <span className="template-default">默认</span>}</div><input className="template-name" aria-label={`${template.id} 模板名称`} value={template.name} onChange={(event) => commit(updateTemplate(templates, template.id, { name: event.target.value }))} /><p>{template.description || '暂无说明'}</p><details><summary>查看配置</summary><pre>{JSON.stringify(template.config, null, 2)}</pre></details><div className="template-card__actions"><button className="icon-button" aria-label={`复制${template.name}`} onClick={() => { const copy = copyTemplate(template); commit([copy, ...templates]); setMessage(`已复制“${template.name}”。`); }}><Copy size={15} /></button>{template.active === false ? <button className="text-button" onClick={() => { commit(updateTemplate(templates, template.id, { active: true })); setMessage('模板已重新启用。'); }}><Power size={14} />启用</button> : <button className="text-button" onClick={() => { commit(deactivateTemplate(templates, template.id)); setMessage('模板已停用，可在全部筛选中恢复。'); }}><Power size={14} />停用</button>}<button className="text-button" onClick={() => { commit(restoreDefaultTemplate(templates, template.id)); setMessage('已恢复默认配置。'); }}><RotateCcw size={14} />恢复默认</button></div></article>)}</section>
  </main>;
}
