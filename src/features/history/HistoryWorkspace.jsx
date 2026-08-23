import { useMemo, useRef, useState } from 'react';
import { Archive, Download, FolderClock, RotateCcw, Upload } from 'lucide-react';
import { cloneProject, archiveProject, buildBackupPayload, compareProjects, listProjects, restoreBackup, saveHistoryProject, serialiseBackup } from './index.js';
import { applyBackup as applyFullBackup, collectBackup as collectFullBackup, estimateProjectBytes, formatBytes, removeAnalysisProject, summariseBackup, validateBackup as validateFullBackup } from '../../lib/projects/index.js';
import './history-workspace.css';

const sampleProjects = [
  { id: 'week-34', name: '2026 年第 34 周商品经营分析', period: '8 月 18–24 日', updatedAt: '2026-08-24T18:20:00.000Z', selectedTables: ['sales', 'traffic'], progress: 0.42 },
  { id: 'week-33', name: '2026 年第 33 周商品经营分析', period: '8 月 11–17 日', updatedAt: '2026-08-17T17:10:00.000Z', selectedTables: ['sales', 'traffic'], progress: 1 },
];

function getStorage(storage) { return storage ?? (typeof window !== 'undefined' ? window.localStorage : null); }

export default function HistoryWorkspace({ storage: storageProp }) {
  const storage = getStorage(storageProp);
  const [projects, setProjects] = useState(() => listProjects(storage).length ? listProjects(storage) : sampleProjects);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [comparisonIds, setComparisonIds] = useState([]);
  const [message, setMessage] = useState('历史项目会保留字段映射、规则和分析进度。');
  const fileRef = useRef(null);
  const fullFileRef = useRef(null);
  const visible = useMemo(() => listProjects(projects, { includeArchived }), [projects, includeArchived]);

  const persist = (next) => { setProjects(next); next.forEach((project) => { try { if (storage) saveHistoryProject(project, storage); } catch { /* read-only preview */ } }); };
  const cloneLatest = () => { const source = visible[0]; if (!source) return; const copy = cloneProject(source); persist([copy, ...projects]); setMessage(`已复制“${source.name}”，可以替换本周数据。`); };
  const toggleArchive = (project) => { const next = archiveProject(project, !project.archived); persist(projects.map((item) => item.id === project.id ? next : item)); setMessage(next.archived ? '项目已归档。' : '项目已恢复。'); };
  const exportBackup = () => { const blob = new Blob([serialiseBackup({ projects })], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'merch-workbench-backup.json'; anchor.click(); URL.revokeObjectURL(url); setMessage('备份包已导出，API Key 不会包含在文件中。'); };
  const importBackup = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const payload = JSON.parse(await file.text()); const result = restoreBackup(payload, projects, { strategy: 'copy' }); persist(result.projects); setMessage(`已恢复 ${result.restoredIds.length} 个项目（冲突项目另存为副本）。`); } catch (error) { setMessage(`恢复失败：${error.message}`); } finally { event.target.value = ''; } };
  const exportFullSnapshot = () => { const snapshot = collectFullBackup(storage ?? undefined); const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `workbench-full-backup-${String(snapshot.exportedAt).slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url); setMessage(`全量快照已导出（${snapshot.entries.length} 条本地记录），含任务、异常、热点与报告草稿。`); };
  const importFullSnapshot = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const payload = JSON.parse(await file.text()); const verdict = validateFullBackup(payload); if (!verdict.ok) throw new Error(verdict.errors[0]); const summary = summariseBackup(payload); const confirmed = window.confirm(`将写入 ${summary.total} 条本地记录（项目 ${summary.project}、报告草稿 ${summary.reportDraft}、任务 ${summary.task}、异常 ${summary.issue}、热点 ${summary.trend}）。同键内容会被覆盖，继续？`); if (!confirmed) return; const applied = applyFullBackup(payload, storage ?? undefined); setMessage(`全量恢复完成，共写入 ${applied} 条记录。刷新后生效。`); } catch (error) { setMessage(`全量恢复失败：${error.message}`); } finally { event.target.value = ''; } };

  const comparison = useMemo(() => {
    if (comparisonIds.length !== 2) return null;
    const selected = comparisonIds.map((id) => projects.find((project) => project.id === id)).filter(Boolean);
    return selected.length === 2 ? compareProjects(selected[0], selected[1]) : null;
  }, [comparisonIds, projects]);
  const toggleComparison = (id) => setComparisonIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]);

  return <main className="history-workspace" data-testid="history-workspace">
    <section className="history-hero glass-card"><div><span className="eyebrow"><FolderClock size={14} /> PROJECT ARCHIVE · 本地历史</span><h1>历史项目与备份</h1><p>复制上周配置，保留每次分析的证据和规则，换电脑也能恢复。</p></div><div className="history-actions"><button className="secondary-button" onClick={() => fileRef.current?.click()}><Upload size={15} /> 导入备份<input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importBackup} /></button><button className="primary-button" onClick={exportBackup}><Download size={15} /> 导出备份</button><button className="secondary-button" onClick={() => fullFileRef.current?.click()}><Upload size={15} /> 全量恢复<input ref={fullFileRef} type="file" accept="application/json,.json" hidden onChange={importFullSnapshot} /></button><button className="secondary-button" onClick={exportFullSnapshot}><Download size={15} /> 全量备份</button></div></section>
    <section className="history-toolbar"><div><strong>{visible.length}</strong> 个{includeArchived ? '' : '活跃'}项目</div><div className="history-toolbar-actions"><button className="text-button" onClick={cloneLatest}><RotateCcw size={15} />复制上周项目</button><label className="history-toggle"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} />显示已归档</label><span className="history-compare-hint">已选 {comparisonIds.length}/2 个对比</span></div></section>
    <p className="history-message" role="status">{message}</p>
    {comparison && <section className="history-comparison glass-card" data-testid="history-comparison"><div className="history-comparison-heading"><div><span className="section-kicker">COMPARE · PRD §17.2</span><h2>项目周期对比</h2></div><button className="text-button" onClick={() => setComparisonIds([])}>清除对比</button></div><div className="history-comparison-table-wrap"><table className="history-comparison-table"><thead><tr><th>字段</th><th>{comparison.left.name}</th><th>{comparison.right.name}</th></tr></thead><tbody>{comparison.rows.map((row) => <tr className={row.changed ? 'is-changed' : ''} key={row.key}><th>{row.label}</th><td>{row.left}</td><td>{row.right}</td></tr>)}</tbody></table></div></section>}
    <section className="history-list">{visible.map((project) => <article className={`history-project glass-card ${project.archived ? 'is-archived' : ''}`} key={project.id}><div className="history-project-main"><div className="history-project-title"><h2>{project.name}</h2>{project.archived && <span className="soft-status">已归档</span>}</div><div className="history-project-meta"><span>{project.period ?? '未设置周期'}</span><span>更新于 {String(project.updatedAt ?? '').slice(0, 10) || '—'}</span><span>{project.selectedTables?.length ?? 0} 张数据表</span>{project.schemaVersion >= 2 && <span>本地占用约 {formatBytes(estimateProjectBytes(project))}</span>}</div><div className="history-progress"><span style={{ width: `${Math.round((project.progress ?? 0) * 100)}%` }} /></div></div><div className="history-project-actions"><label className="history-compare-check"><input type="checkbox" checked={comparisonIds.includes(project.id)} onChange={() => toggleComparison(project.id)} />对比</label><button className="icon-button" aria-label={`归档${project.name}`} onClick={() => toggleArchive(project)}><Archive size={16} /></button><button className="text-button" onClick={() => { const copy = cloneProject(project); persist([copy, ...projects]); setMessage('已创建项目副本。'); }}>复制</button>{<button className="text-button" onClick={() => { if (window.confirm(`删除项目「${project.name}」及其本地草稿？该操作不可恢复。`)) { removeAnalysisProject(project.id, storage, { includeReportDrafts: true }); setProjects((current) => current.filter((item) => item.id !== project.id)); setComparisonIds((current) => current.filter((id) => id !== project.id)); setMessage(`已删除「${project.name}」。`); } }}>删除</button>}</div></article>)}</section>
  </main>;
}

export { sampleProjects };
