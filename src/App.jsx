import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  CloudSun,
  Download,
  FileBarChart,
  FileText,
  Flame,
  FolderClock,
  FolderPlus,
  History,
  Home,
  Languages,
  LayoutTemplate,
  Menu,
  PackageSearch,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Moon,
  Sun,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  Upload,
} from 'lucide-react';
import { applyManualMapping, chainJoins, checkDataQuality, fingerprintColumns, loadRememberedMapping, matchTables, mergeDuplicateRows, parseSpreadsheet, previewTable, rememberMapping, suggestFieldMappings, suggestJoinKeys } from './lib/data/index.js';
import { buildAnomalyHypothesisRequest, buildChatEndpoint, callChatCompletion, readSavedSettings } from './lib/ai/index.js';
import { validateAiConfig } from './features/settings/index.js';
import { applyTaskResolutions, diagnosticToIssuePayload, diagnosticToTaskPayload } from './lib/associations/index.js';
import { createAnalysisProject, estimateProjectBytes, findLatestAnalysisProject, formatBytes, removeAnalysisProject, saveAnalysisProject, saveAnalysisSummary } from './lib/projects/index.js';
import { buildAnalysisSnapshot } from './lib/projects/index.js';
import { buildTrendSeries, computeDerivedMetrics, computePeriodComparison, createRule, evaluateRules, filterAnalysisRows } from './lib/analysis/metrics.js';
import { aggregateTrafficWithSales, buildDiagnostic, buildImportedAnalysis, buildTodayBrief, daysSinceLastImport, detectAnomalies } from './lib/analysis/index.js';
import { enableAndSendDailyNotification, queryNotifyPermission } from './lib/notify/index.js';
import { getMonthlyTarget, monthProgress, setMonthlyTarget } from './lib/goals/index.js';
import { buildSparklineGeometry, buildSparklinePoints } from './lib/analysis/sparkline.js';
import { loadAnnotations, saveAnnotations, upsertAnnotation } from './lib/storage/annotations.js';
import { materializeRecurringTasks, shouldRunWeeklyBackup, WEEKLY_BACKUP_META_KEY } from './lib/automation/index.js';
import { collectBackup as collectFullBackup } from './lib/projects/index.js';
import { buildFunnel, buildPivot } from './lib/analysis/pivot.js';
import { exportReportWorkbook } from './lib/export/index.js';
import { exerciseTasks, quickStartTutorial, sampleFixtureBundle, sampleTables } from './lib/fixtures/index';
import TitleWorkspace from './features/title/TitleWorkspace.jsx';
import TutorialCenter from './features/tutorial/TutorialCenter.jsx';
import ReportWorkspace from './features/report/ReportWorkspace.jsx';
import IssueWorkspace from './features/issues/IssueWorkspace.jsx';
import TaskWorkspace from './features/tasks/TaskWorkspace.jsx';
import ProductDrilldown from './features/analysis/ProductDrilldown.jsx';
import CommandPalette from './features/palette/CommandPalette.jsx';
import HistoryWorkspace from './features/history/HistoryWorkspace.jsx';
import TrendWorkspace from './features/trends/TrendWorkspace.jsx';
import TemplateCenter from './features/templates/TemplateCenter.jsx';
import SettingsWorkspace from './features/settings/SettingsWorkspace.jsx';
import ErrorBoundary from './features/shared/ErrorBoundary.jsx';
import './features/tutorial/TutorialCenter.css';
import './features/issues/issues-workspace.css';
import './features/tasks/tasks.css';
import './features/history/history-workspace.css';
import './features/trends/trends-workspace.css';
import './features/templates/templates-workspace.css';
import './features/settings/settings-workspace.css';

const navigation = [
  { label: '首页', icon: Home },
  { label: '商品数据分析', icon: BarChart3 },
  { label: '标题优化', icon: Languages },
  { label: '热点与选品', icon: Flame },
  { label: '供应商问题', icon: Truck },
  { label: '日常任务', icon: ClipboardCheck },
  { label: '周报与报告', icon: FileText },
  { label: '历史项目', icon: History },
  { label: '模板中心', icon: LayoutTemplate },
  { label: '教程与帮助', icon: CircleHelp },
  { label: '设置与数据管理', icon: Settings },
];

const workflow = [
  { label: '导入数据', status: 'done' },
  { label: '字段匹配', status: 'done' },
  { label: '数据分析', status: 'active' },
  { label: '策略确认', status: 'todo' },
  { label: '导出报告', status: 'todo' },
];

const tasks = [
  { title: '确认 18 个异常商品', meta: '数据分析 · 今天', priority: '高', tone: 'danger' },
  { title: '审核本周标题候选', meta: '标题优化 · 还有 32 条', priority: '中', tone: 'warning' },
  { title: '跟进供应商库存反馈', meta: '供应商问题 · 明天到期', priority: '中', tone: 'warning' },
];

const formInputStyle = { border: '1px solid var(--line)', borderRadius: 9, padding: '7px 9px', background: 'rgba(255,255,255,.72)', width: '100%', boxSizing: 'border-box' };

function getDashboardTasks(savedTasks = [], savedIssues = []) {
  const taskItems = Array.isArray(savedTasks) ? savedTasks.filter((item) => item.status !== '已完成' && item.status !== '已取消').map((item) => ({ title: item.title, meta: `日常任务 · ${item.dueDate || '未设置截止日期'}`, priority: item.priority || '中', tone: item.priority === '高' ? 'danger' : 'warning' })) : [];
  const issueItems = Array.isArray(savedIssues) ? savedIssues.filter((item) => item.status !== '已解决' && item.status !== '已关闭').map((item) => ({ title: item.title, meta: `供应商问题 · ${item.dueDate || '未设置截止日期'}`, priority: item.priority || '中', tone: item.priority === '高' ? 'danger' : 'warning' })) : [];
  return [...taskItems, ...issueItems].slice(0, 4);
}

const quickActions = [
  { label: '导入数据', note: 'Excel / CSV', icon: Upload, action: '商品数据分析' },
  { label: '新建分析项目', note: '从空白开始', icon: Plus, action: '商品数据分析' },
  { label: '复制上周项目', note: '沿用配置', icon: FolderClock, action: '历史项目' },
];

function Sidebar({ active, onSelect, isOpen, onClose, supplierIssueCount = 0 }) {
  return (
    <>
      <button className={`sidebar-backdrop ${isOpen ? 'is-visible' : ''}`} onClick={onClose} aria-label="关闭导航" />
      <aside className={`sidebar glass-panel ${isOpen ? 'is-open' : ''}`} data-testid="primary-sidebar">
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={20} /></div>
          <div>
            <strong>运营工作台</strong>
            <span>Merch Studio</span>
          </div>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="收起导航">
            <PanelLeftClose size={18} />
          </button>
        </div>

        <nav aria-label="主要导航">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`nav-item ${active === label ? 'is-active' : ''}`}
              data-testid={`nav-${label}`}
              key={label}
              onClick={() => { onSelect(label); onClose(); }}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
              {label === '供应商问题' && supplierIssueCount > 0 && <em>{supplierIssueCount}</em>}
            </button>
          ))}
        </nav>

        <div className="sidebar-tip">
          <div className="tip-icon"><BookOpen size={17} /></div>
          <div>
            <strong>新手练习</strong>
            <p>用模拟数据走完第一次分析</p>
          </div>
          <ChevronRight size={16} />
        </div>
      </aside>
    </>
  );
}

function MetricCard({ item }) {
  const Icon = item.icon;
  return (
    <article className="metric-card glass-card">
      <div className={`metric-icon ${item.tone}`}><Icon size={19} /></div>
      <div className="metric-heading"><span>{item.label}</span><CircleHelp size={14} /></div>
      {item.value == null
        ? <strong className="metric-unset">尚未配置</strong>
        : <strong>{item.value}</strong>}
      <small className={item.tone === 'orange' ? 'warning-text' : ''}>{item.trend}</small>
    </article>
  );
}

function Dashboard({ onNavigate, savedTasks = [], savedIssues = [] }) {
  // PRD §7.2：首页指标与最近项目使用真实本地数据；缺数据时显示「尚未配置」，不显示虚假 0。
  const latestProject = (() => { try { return findLatestAnalysisProject(window.localStorage); } catch { return null; } })();
  const summary = latestProject?.analysisSummary;
  const totals = summary?.totals;
  const resolvedDiagnosticCount = applyTaskResolutions(summary?.diagnostics ?? [], savedTasks).filter((item) => item.status === '已解决').length;
  const openDiagnosticCount = summary ? Math.max((summary.diagnostics?.length ?? 0) - resolvedDiagnosticCount, 0) : null;
  const dashboardMetrics = [
    { label: '销售额', value: totals ? `¥ ${Math.round(totals.salesAmount).toLocaleString()}` : null, trend: totals ? `${summary.rowCount} 行导入明细` : '导入数据后生成', icon: TrendingUp, tone: 'pink' },
    { label: '曝光量', value: totals ? totals.impressions.toLocaleString() : null, trend: totals ? `${totals.clicks.toLocaleString()} 次点击` : '导入后生成', icon: CloudSun, tone: 'purple' },
    { label: '点击率', value: totals ? `${(totals.clickRate * 100).toFixed(2)}%` : null, trend: totals ? `支付 ${totals.paid.toLocaleString()} 件` : '导入后生成', icon: PackageSearch, tone: 'blue' },
    { label: '待确认异常', value: openDiagnosticCount == null ? null : String(openDiagnosticCount), trend: openDiagnosticCount == null ? '分析后生成' : (openDiagnosticCount === 0 && (summary?.diagnostics?.length ?? 0) > 0 ? '已全部解决 ✓' : ((summary?.diagnostics ?? []).some((item) => item.priority === '高') ? '含高优先级' : '暂无高优先级')), icon: AlertTriangle, tone: 'orange' },
  ];
  const [compareMode, setCompareMode] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('merch-workbench:prefs') ?? '{}').baseline ?? 'prev'; } catch { return 'prev'; }
  });
  const switchCompareMode = () => {
    const next = compareMode === 'prev' ? 'lastWeekSame' : 'prev';
    setCompareMode(next);
    try { window.localStorage.setItem('merch-workbench:prefs', JSON.stringify({ baseline: next })); } catch {}
  };
  const [metricsPanelOpen, setMetricsPanelOpen] = useState(false);
  const [hiddenMetricLabels, setHiddenMetricLabels] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('merch-workbench:prefs') ?? '{}').hiddenMetrics ?? []; } catch { return []; }
  });
  const persistHiddenMetrics = (list) => {
    setHiddenMetricLabels(list);
    try {
      const prefs = JSON.parse(window.localStorage.getItem('merch-workbench:prefs') ?? '{}');
      window.localStorage.setItem('merch-workbench:prefs', JSON.stringify({ ...prefs, hiddenMetrics: list }));
    } catch { /* 只读环境忽略 */ }
  };
  const todayBrief = buildTodayBrief({ trend: summary?.trend ?? [], diagnostics: summary?.diagnostics ?? [], tasks: savedTasks, compareMode });
  const [notifyState, setNotifyState] = useState(() => queryNotifyPermission());
  const notifySentRef = useRef(false);
  useEffect(() => {
    if (notifyState !== 'granted' || notifySentRef.current) return;
    notifySentRef.current = true;
    enableAndSendDailyNotification({ overdueTasks: todayBrief.overdue, dueTodayTasks: todayBrief.dueToday, highRiskDiagnostics: (summary?.diagnostics ?? []).filter((item) => item.priority === '高' && item.status !== '已解决').length, weeklyNudge: new Date().getDay() === 1 && (summary?.diagnostics?.length ?? 0) > 0 });
  }, [notifyState]);
  const projectId = latestProject?.id ?? '';
  const [monthlyTarget, setTargetState] = useState(() => getMonthlyTarget(null, projectId));
  useEffect(() => { setTargetState(getMonthlyTarget(null, projectId)); }, [projectId]);
  const targetProgress = monthProgress({ trend: summary?.trend ?? [], target: monthlyTarget });
  const commitMonthlyTarget = (value) => { setMonthlyTarget(null, projectId, value); setTargetState(Math.max(0, Number(value) || 0)); };
  const requestNotifications = async () => {
    const sent = await enableAndSendDailyNotification({ overdueTasks: todayBrief.overdue, dueTodayTasks: todayBrief.dueToday, highRiskDiagnostics: (summary?.diagnostics ?? []).filter((item) => item.priority === '高' && item.status !== '已解决').length, weeklyNudge: new Date().getDay() === 1 && (summary?.diagnostics?.length ?? 0) > 0 });
    setNotifyState(queryNotifyPermission());
    if (!sent) setNotifyState((current) => current);
  };
  const openTaskCount = savedTasks.filter((item) => item.status !== '已完成' && item.status !== '已取消').length;
  const openSupplierIssueCount = savedIssues.filter((item) => item.status !== '已解决' && item.status !== '已关闭').length;
  const dashboardTasks = getDashboardTasks(savedTasks, savedIssues);
  return (
    <main className="dashboard" data-testid="dashboard-home">
      <section className="welcome-card glass-card">
        <div className="welcome-copy">
          <span className="eyebrow"><Sparkles size={14} /> 2026 年第 34 周</span>
          <h1>今日工作驾驶舱</h1>
          <p className="welcome-greeting">早上好，今天也稳稳推进吧。</p>
          <p>你有 <strong>{openTaskCount + openSupplierIssueCount} 项待办</strong>{openTaskCount > 0 ? `，其中 ${openTaskCount} 项日常任务` : ''}{openSupplierIssueCount > 0 ? `，${openSupplierIssueCount} 个供应商问题待处理` : ''}。</p>
        </div>
        <div className="quick-actions">
          {quickActions.map(({ label, note, icon: Icon, action }, index) => (
            <button className={index === 0 ? 'quick-action is-primary' : 'quick-action'} key={label} onClick={() => onNavigate(action)}>
              <Icon size={19} />
              <span><strong>{label}</strong><small>{note}</small></span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
      </section>

      {(todayBrief.yesterdayValue != null || todayBrief.topIssues.length > 0 || todayBrief.dueToday > 0 || todayBrief.overdue > 0) && (
        <section className="glass-card" style={{ padding: '12px 18px', marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <strong style={{ fontSize: 14 }}>今日概览</strong>
            {todayBrief.yesterdayValue != null && <button className="text-button" onClick={switchCompareMode} title="切换环比对比基线">对比：{compareMode === 'lastWeekSame' ? '上周同日' : '前一日'} ⇄</button>}
            {todayBrief.yesterdayValue != null && <span className="soft-status">最近数据日 {todayBrief.date}：销售额 {todayBrief.yesterdayValue.toLocaleString()}{todayBrief.changePct != null ? `（对比${compareMode === 'lastWeekSame' ? '上周同日' : '前一日'} ${todayBrief.changePct > 0 ? '+' : ''}${todayBrief.changePct}%）` : ''}</span>}
            {todayBrief.topIssues.map((item) => <span key={item.finding} className="soft-status">⚠ {item.finding}（{item.priority}）</span>)}
            {todayBrief.dueToday > 0 && <span className="priority-tag">今日到期任务 {todayBrief.dueToday}</span>}
            {todayBrief.overdue > 0 && <span className="priority-tag">逾期 {todayBrief.overdue}</span>}
            {todayBrief.staleDays != null && todayBrief.staleDays >= 2 && <span className="priority-tag">已 {todayBrief.staleDays} 天未导入数据</span>}
            {notifyState === 'default' && <button className="text-button" onClick={requestNotifications}>开启桌面提醒</button>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <strong style={{ fontSize: 14 }}>本月目标</strong>
            {targetProgress.target > 0 ? (
              <>
                <div style={{ flex: '1 1 180px', height: 8, borderRadius: 99, background: 'rgba(0,0,0,.08)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.round((targetProgress.ratio ?? 0) * 100)}%`, height: '100%', background: targetProgress.done ? '#3a9d6d' : '#b36587' }} />
                </div>
                <span className="soft-status">{targetProgress.monthSales.toLocaleString()} / {targetProgress.target.toLocaleString()}（{Math.round((targetProgress.ratio ?? 0) * 100)}%）{targetProgress.done ? ' ✓ 已达标' : ` · 还差 ${targetProgress.remain.toLocaleString()}`}</span>
              </>
            ) : (
              <span style={{ color: '#96707f', fontSize: 12 }}>设定后按趋势数据自动统计当月销售额进度</span>
            )}
            <input type="number" min="0" placeholder="目标额" value={monthlyTarget || ''} onChange={(event) => commitMonthlyTarget(event.target.value)} style={{ width: 110 }} />
          </div>
        </section>
      )}
      <section aria-labelledby="metric-title">
        <div className="section-heading">
          <div><span className="section-kicker">THIS WEEK</span><h2 id="metric-title">本周数据概览</h2></div>
          <button className="text-button" onClick={() => setMetricsPanelOpen((open) => !open)}>自定义指标 <Settings size={15} /></button>
        </div>
        {metricsPanelOpen && (
          <div className="glass-card" style={{ padding: '10px 14px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#96707f' }}>选择要展示的指标：</span>
            {dashboardMetrics.map((item) => (
              <label key={item.label} className="history-toggle">
                <input
                  type="checkbox"
                  checked={!hiddenMetricLabels.includes(item.label)}
                  onChange={() => persistHiddenMetrics(hiddenMetricLabels.includes(item.label) ? hiddenMetricLabels.filter((label) => label !== item.label) : [...hiddenMetricLabels, item.label])}
                />
                {item.label}
              </label>
            ))}
            {hiddenMetricLabels.length > 0 && <button className="text-button" onClick={() => persistHiddenMetrics([])}>全部显示</button>}
          </div>
        )}
        <div className="metrics-grid">
          {dashboardMetrics.filter((item) => !hiddenMetricLabels.includes(item.label)).map((item) => <MetricCard item={item} key={item.label} />)}
        </div>
      </section>

      <div className="content-grid">
        <section className="panel-card glass-card workflow-card">
          <div className="panel-heading">
            <div><span className="section-kicker">CURRENT PROJECT</span><h2>{latestProject?.name ?? '还没有分析项目'}</h2></div>
            <button className="text-button" onClick={() => onNavigate('商品数据分析')}>继续分析 <ArrowRight size={15} /></button>
          </div>
          <div className="project-meta">
            <span><Store size={14} /> {latestProject?.site ?? '未设置站点'}</span>
            <span><Boxes size={14} /> {latestProject?.categoryRange ?? '未设置品类'}</span>
            <span><Clock3 size={14} /> {latestProject?.period && latestProject.period !== '未设置' ? latestProject.period : '未设置周期'}</span>
          </div>
          <div className="workflow-track">
            {workflow.map((step, index) => (
              <div className={`workflow-step ${step.status}`} key={step.label}>
                <div className="workflow-dot">{step.status === 'done' ? <CheckCircle2 size={18} /> : index + 1}</div>
                <span>{step.label}</span>
              </div>
            ))}
          </div>
          <div className="project-progress"><span style={{ width: `${Math.round((latestProject?.progress ?? 0) * 100)}%` }} /></div>
          <div className="project-footer"><span>{latestProject ? `进度 ${Math.round((latestProject.progress ?? 0) * 100)}% · 更新于 ${String(latestProject.updatedAt ?? '').slice(0, 10)}` : '创建项目后这里显示分析进度'}</span><strong>{summary?.rowCount ? `已导入 ${summary.rowCount} 行明细` : '下一步：导入数据'}</strong></div>
        </section>

        <section className="panel-card glass-card task-card">
          <div className="panel-heading">
            <div><span className="section-kicker">TO DO</span><h2>今日待办</h2></div>
            <button className="round-button" aria-label="添加待办"><Plus size={17} /></button>
          </div>
          <div className="task-list">
            {(dashboardTasks.length ? dashboardTasks : tasks).map((task) => (
              <button className="task-row" key={task.title}>
                <span className="task-check" />
                <span className="task-copy"><strong>{task.title}</strong><small>{task.meta}</small></span>
                <span className={`tag ${task.tone}`}>{task.priority}</span>
              </button>
            ))}
          </div>
          <button className="full-text-button">查看全部待办 <ArrowRight size={15} /></button>
        </section>

        <section className="panel-card glass-card insight-card">
          <div className="panel-heading">
            <div><span className="section-kicker">AI ASSISTANT</span><h2>策略诊断提示</h2></div>
            <span className="ai-badge"><Sparkles size={13} /> AI 辅助假设</span>
          </div>
          <div className="insight-body">
            <div className="insight-visual"><BarChart3 size={27} /></div>
            <div>
              <strong>高曝光低点击商品值得优先检查</strong>
              <p>18 款商品曝光位于品类前 20%，但点击率低于品类中位数。可能与标题卖点、主图或流量人群有关。</p>
            </div>
          </div>
          <div className="evidence-row"><span>证据：曝光、点击率</span><span>优先级：高</span><button>查看详情</button></div>
        </section>

        <section className="panel-card glass-card learning-card">
          <div className="learning-illustration"><BookOpen size={28} /></div>
          <div>
            <span className="section-kicker">LEARNING MODE</span>
            <h2>今天学会：数据透视表</h2>
            <p>用 5 分钟了解如何按品类汇总销售额，并在 Excel 中复现。</p>
            <button className="primary-button" onClick={() => onNavigate('教程与帮助')}>开始练习 <ArrowRight size={16} /></button>
          </div>
        </section>
      </div>

      <p className="demo-note">当前页面使用示例数据，仅用于展示界面。</p>
    </main>
  );
}

function AnalysisWorkspace({ onAddTask, onAddIssue }) {
  // PRD §18：刷新后从本地恢复最近的分析项目，继续未完成的工作。
  const restoredProjectRef = useRef(null);
  if (restoredProjectRef.current === null) {
    try { restoredProjectRef.current = findLatestAnalysisProject(window.localStorage); } catch { restoredProjectRef.current = false; }
  }
  const restoredProject = restoredProjectRef.current && typeof restoredProjectRef.current === 'object' ? restoredProjectRef.current : null;
  const [loaded, setLoaded] = useState(Boolean(restoredProject));
  const [selectedTable, setSelectedTable] = useState(restoredProject ? 'imported:0' : 'sales');
  const [dataMode, setDataMode] = useState(restoredProject ? 'imported' : 'sample');
  const [notice, setNotice] = useState(restoredProject ? `已恢复项目「${restoredProject.name}」的本地数据副本，可以继续分析。` : '还没有载入数据。建议先用示例数据练习完整流程。');
  const [importedFiles, setImportedFiles] = useState(() => restoredProject?.sheets ?? []);
  const availableTables = useMemo(() => [
    ...sampleTables.map((item) => ({ ...item, tableId: item.name, source: 'sample' })),
    ...importedFiles.map((item, index) => ({
      ...item,
      tableId: `imported:${index}`,
      label: `${item.fileName} / ${item.name}`,
      description: '用户导入的本地工作表',
      source: 'imported',
      columns: (item.headers ?? []).map((header) => ({ key: header, label: header, type: 'text' })),
    })),
  ], [importedFiles]);
  const table = availableTables.find((item) => item.tableId === selectedTable) ?? availableTables[0];
  const headers = table?.columns?.map((column) => column.key) ?? [];
  const rows = table?.rows ?? [];
  const preview = useMemo(() => previewTable({ headers, rows }, { limit: 6 }), [headers, rows]);
  const quality = useMemo(() => checkDataQuality({ headers, rows }, { key: table?.primaryKey }), [headers, rows, table?.primaryKey]);
  const mapping = useMemo(() => suggestFieldMappings(table?.columns?.map((column) => column.label) ?? [], ['productId', 'salesAmount', 'category', 'supplier']), [table]);
  const [incrementalMerge, setIncrementalMerge] = useState(true);
  const [manualMapping, setManualMapping] = useState(() => restoredProject?.snapshot?.fieldMapping ?? {});
  const importedAnalysisBase = useMemo(() => dataMode === 'imported' ? buildImportedAnalysis(importedFiles, { manualMapping }) : { rows: [], reason: '' }, [dataMode, importedFiles, manualMapping]);
  const importedAnalysis = useMemo(() => {
    if (!incrementalMerge) return importedAnalysisBase;
    if ((importedAnalysisBase.rows?.length ?? 0) === 0) return importedAnalysisBase;
    const merged = mergeDuplicateRows(importedAnalysisBase.rows);
    return { ...importedAnalysisBase, rows: merged.rows, mergedCount: merged.mergedCount };
  }, [incrementalMerge, importedAnalysisBase]);
  // PRD §8.6 扩展：日期/品类筛选 + 明确口径的指标汇总与环比。
  const [analysisFilters, setAnalysisFilters] = useState({ dateFrom: '', dateTo: '', category: '' });
  const filteredImportedRows = useMemo(() => filterAnalysisRows(importedAnalysis.rows, analysisFilters), [importedAnalysis, analysisFilters]);
  const importedMetrics = useMemo(() => computeDerivedMetrics(filteredImportedRows), [filteredImportedRows]);
  const importedComparison = useMemo(() => {
    const dates = [...new Set(importedAnalysis.rows.map((row) => String(row.date ?? '')).filter(Boolean))].sort();
    if (dates.length < 2) return [];
    return computePeriodComparison(filteredImportedRows.filter((row) => row.date === dates[dates.length - 1]), filteredImportedRows.filter((row) => row.date === dates[0]), ['salesAmount', 'paid', 'impressions', 'clicks']);
  }, [filteredImportedRows, importedAnalysis]);
  const importedCategories = useMemo(() => [...new Set(importedAnalysis.rows.map((row) => row.category).filter(Boolean))], [importedAnalysis]);
  const importedTrend = useMemo(() => buildTrendSeries(filteredImportedRows), [filteredImportedRows]);
  const importedFingerprint = useMemo(() => {
    const allHeaders = (importedFiles ?? []).flatMap((file) => (file?.sheets ?? []).flatMap((sheet) => sheet?.headers ?? []));
    return fingerprintColumns(allHeaders);
  }, [importedFiles]);
  const recalledRef = useRef('');
  useEffect(() => {
    if (!importedFingerprint || recalledRef.current === importedFingerprint) return;
    recalledRef.current = importedFingerprint;
    if (Object.keys(manualMapping ?? {}).length > 0) return;
    const remembered = loadRememberedMapping(null, importedFingerprint);
    if (remembered) {
      setManualMapping(remembered);
      setNotice('已按列结构自动套用上次保存的字段映射，可在 STEP 04 调整。');
    }
  }, [importedFingerprint, manualMapping]);
  useEffect(() => {
    if (dataMode !== 'imported' || !importedFingerprint) return;
    if (Object.keys(manualMapping ?? {}).length === 0) return;
    if ((importedAnalysis?.rows?.length ?? 0) === 0) return;
    rememberMapping(null, importedFingerprint, manualMapping);
  }, [dataMode, importedFingerprint, manualMapping, importedAnalysis]);
  const importedTrendPoints = useMemo(() => buildSparklinePoints(importedTrend.map((point) => point.value), { width: 240, height: 48 }), [importedTrend]);
  const [annotations, setAnnotations] = useState(() => loadAnnotations());
  const [annotationDraft, setAnnotationDraft] = useState({ date: '', label: '' });
  const commitAnnotation = () => {
    if (!annotationDraft.date || !annotationDraft.label.trim()) return;
    const next = upsertAnnotation(annotations, annotationDraft.date, annotationDraft.label);
    setAnnotations(next);
    saveAnnotations(next);
    setAnnotationDraft({ date: '', label: '' });
    setNotice('已保存事件标注，趋势图上会出现标记点。');
  };
  const removeAnnotation = (date) => {
    const next = upsertAnnotation(annotations, date, '');
    setAnnotations(next);
    saveAnnotations(next);
  };
  const exportTrendPng = () => {
    const svg = document.getElementById('analysis-trend-svg');
    if (!svg) { setNotice('未找到趋势图，请先导入数据。'); return; }
    const xml = new XMLSerializer().serializeToString(svg);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 192;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = '销售额趋势.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      setNotice('趋势图已导出为 PNG。');
    };
    image.onerror = () => setNotice('导出失败：浏览器不支持该操作。');
    image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  };
  const setManualField = (target, source) => setManualMapping((current) => applyManualMapping(current, target, source));
  // 异常诊断 → 任务/供应商问题（PRD §8 确认策略闭环）。
  const [convertedDiagnostics, setConvertedDiagnostics] = useState([]);
  // PRD §8.6 扩展：可配置异常规则（指标 + 操作符 + 阈值），命中结果与默认规则并列展示。
  const [customRules, setCustomRules] = useState([]);
  const [ruleDraft, setRuleDraft] = useState({ metric: 'clickRate', operator: 'lt', threshold: '0.03' });
  const addRule = () => {
    try {
      const rule = createRule({ id: `rule-${customRules.length + 1}-${ruleDraft.metric}`, label: `${ruleMetricLabels[ruleDraft.metric]} ${ruleDraft.operator === 'lt' ? '<' : '≥'} ${ruleDraft.threshold}`, metric: ruleDraft.metric, operator: ruleDraft.operator, threshold: ruleDraft.threshold });
      setCustomRules((current) => [...current, rule]);
    } catch { /* 非法输入忽略，按钮已做基础约束 */ }
  };
  const customRuleHits = useMemo(() => (dataMode === 'imported' && filteredImportedRows.length && customRules.length ? evaluateRules(filteredImportedRows, customRules).slice(0, 8) : []), [dataMode, filteredImportedRows, customRules]);
  const [currentProjectId, setCurrentProjectId] = useState(restoredProject?.id ?? null);
  // 报告真实性：把当前导入分析的诊断快照写回项目，报告页据此渲染而非示例数据。
  useEffect(() => {
    if (dataMode !== 'imported' || !currentProjectId || !loaded) return;
    try {
      const totals = filteredImportedRows.reduce((acc, row) => {
        acc.salesAmount += Number(row.salesAmount) || 0;
        acc.impressions += Number(row.impressions) || 0;
        acc.clicks += Number(row.clicks) || 0;
        acc.paid += Number(row.paid) || 0;
        return acc;
      }, { salesAmount: 0, impressions: 0, clicks: 0, paid: 0 });
      totals.clickRate = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
      saveAnalysisSummary(currentProjectId, {
        generatedAt: new Date().toISOString(),
        dataSource: '本地导入',
        rowCount: filteredImportedRows.length,
        totals,
        trend: importedTrend,
        comparison: importedComparison,
        diagnostics: diagnosticsRef.current,
      });
    } catch { /* 只读环境忽略 */ }
  }, [dataMode, currentProjectId, loaded, filteredImportedRows.length, importedComparison]);
  const convertToTask = (diagnostic) => {
    onAddTask?.({ ...diagnosticToTaskPayload(diagnostic), source: 'manual' });
    setConvertedDiagnostics((current) => [...new Set([...current, diagnostic.id + ':task'])]);
    setNotice(`已把「${diagnostic.finding}」加入日常任务。`);
  };
  const convertToIssue = (diagnostic, productId) => {
    onAddIssue?.(diagnosticToIssuePayload({ ...diagnostic, productId }));
    setConvertedDiagnostics((current) => [...new Set([...current, diagnostic.id + ':issue'])]);
    setNotice(`已把「${diagnostic.finding}」加入供应商问题台账。`);
  };
  const importedHeaders = useMemo(() => [...new Set(importedFiles.flatMap((sheet) => sheet.headers ?? []))], [importedFiles]);
  const ruleMetricLabels = { clickRate: '点击率', conversionRate: '支付转化率', impressions: '曝光量', salesAmount: '销售额', aov: '客单价' };
  // PRD §8.4：真实导入的多表匹配——主表 + 关联表 + 关联键，先预览再使用。
  const [joinPlan, setJoinPlan] = useState(null);
  const importedSheetOptions = importedFiles.map((sheet, index) => ({ id: `imported:${index}`, label: `${sheet.fileName} / ${sheet.name}`, sheet }));
  const joinPrimary = importedSheetOptions.find((option) => option.id === joinPlan?.primaryId)?.sheet;
  const joinSecondary = importedSheetOptions.find((option) => option.id === joinPlan?.secondaryId)?.sheet;
  const joinKeySuggestions = useMemo(() => (joinPrimary && joinSecondary ? suggestJoinKeys(joinPrimary.headers ?? [], joinSecondary.headers ?? []) : []), [joinPrimary, joinSecondary]);
  const joinPreview = useMemo(() => {
    if (!joinPlan?.primaryId || !joinPlan?.secondaryId || !joinPlan.primaryKey || !joinPlan.secondaryKey || !joinPrimary || !joinSecondary) return null;
    try {
      const result = matchTables({ headers: joinPrimary.headers ?? [], rows: joinPrimary.rows ?? [] }, { headers: joinSecondary.headers ?? [], rows: joinSecondary.rows ?? [] }, { primaryKey: joinPlan.primaryKey, secondaryKey: joinPlan.secondaryKey });
      return { outputRowCount: result.rows.length, unmatched: result.report?.unmatchedPrimaryKeys?.length ?? 0, duplicates: result.report?.duplicateSecondaryKeys?.length ?? 0 };
    } catch { return null; }
  }, [joinPlan, joinPrimary, joinSecondary]);
  const mappingTargets = [
    { key: 'productId', label: '商品 ID（必选）', required: true },
    { key: 'date', label: '日期' },
    { key: 'impressions', label: '曝光量' },
    { key: 'clicks', label: '点击量' },
    { key: 'orders', label: '支付件数' },
    { key: 'salesAmount', label: '销售额' },
    { key: 'category', label: '品类' },
  ];
  const joinChain = useMemo(() => {
    if (!loaded || dataMode !== 'sample') return null;
    const tables = sampleFixtureBundle.tables;
    return chainJoins(tables.sales.rows, [
      { table: tables.products.rows, key: 'productId', label: '销售 → 商品基础信息', columns: ['productName', 'categoryId', 'supplierId', 'site'] },
      { table: tables.categories.rows, key: 'categoryId', label: '商品 → 品类映射', columns: ['categoryNameZh'] },
      { table: tables.suppliers.rows, key: 'supplierId', label: '商品 → 供应商信息', columns: ['supplierName'] },
    ]);
  }, [loaded, dataMode]);
  const anomalyRows = useMemo(() => {
    if (!loaded) return [];
    const trafficRows = dataMode === 'imported'
      ? filteredImportedRows
      : aggregateTrafficWithSales(sampleFixtureBundle.tables.traffic.rows, sampleFixtureBundle.tables.sales.rows);
    return detectAnomalies(trafficRows, { impressionQuantile: 0.7, lowClickRate: 0.035, lowConversionRate: 0.08 }).slice(0, 4);
  }, [loaded, dataMode, filteredImportedRows]);
  const diagnostics = useMemo(() => anomalyRows.map((anomaly) => buildDiagnostic(anomaly)), [anomalyRows]);
  const diagnosticsRef = useRef(diagnostics);
  useEffect(() => { diagnosticsRef.current = diagnostics; }, [diagnostics]);
  // PRD §16：AI 只生成「辅助假设」；发送前必须展示脱敏预览并手动放行。
  const [aiAssist, setAiAssist] = useState({ status: 'idle', message: '', preview: null, request: null, result: '' });
  const [selectedProductId, setSelectedProductId] = useState('');
  const productDrilldownRows = useMemo(() => filteredImportedRows.filter((row) => String(row.productId ?? '') === String(selectedProductId)), [filteredImportedRows, selectedProductId]);
  const productDrilldown = useMemo(() => {
    if (!selectedProductId) return null;
    const totals = productDrilldownRows.reduce((acc, row) => ({ impressions: acc.impressions + (Number(row.impressions) || 0), clicks: acc.clicks + (Number(row.clicks) || 0), paid: acc.paid + (Number(row.paid) || 0), salesAmount: acc.salesAmount + (Number(row.salesAmount) || 0) }), { impressions: 0, clicks: 0, paid: 0, salesAmount: 0 });
    const byDate = Object.values(productDrilldownRows.reduce((acc, row) => { const date = String(row.date ?? '未设置'); acc[date] = (acc[date] || 0) + (Number(row.salesAmount) || 0); return acc; }, {}));
    return { totals, byDate, rows: productDrilldownRows };
  }, [productDrilldownRows, selectedProductId]);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState({ name: '', periodStart: '', periodEnd: '', site: 'US', categoryRange: '' });
  const [projectNotice, setProjectNotice] = useState('');
  const [exportMessage, setExportMessage] = useState('');

  // PRD §13.3：Excel 导出包含异常商品、品类透视、漏斗汇总和匹配后明细。
  async function exportAnalysisExcel() {
    if (!anomalyRows.length && !sampleAnalysis.pivot.length) {
      setExportMessage(dataMode === 'imported' ? (importedAnalysis.reason || '导入数据暂不足以生成分析结果。') : '请先载入示例数据，再导出分析结果。');
      return;
    }
    try {
      const rate = (value) => ((Number(value) || 0) * 100).toFixed(2) + '%';
      const sheets = [];
      if (anomalyRows.length) sheets.push({
        name: '异常商品',
        rows: anomalyRows.map((item) => ({
          商品ID: item.productId,
          触发规则: item.rule === 'high-impression-low-click' ? '高曝光低点击' : String(item.rule ?? ''),
          曝光量: item.impressions,
          点击率: rate(item.clickRate),
          支付转化率: rate(item.conversionRate),
        })),
      });
      if (sampleAnalysis.pivot.length) sheets.push({
        name: '品类透视',
        rows: sampleAnalysis.pivot.map((row) => ({
          品类: row.group,
          曝光量: row.impressions,
          点击量: row.clicks,
          支付件数: row.paid,
          销售额: Number((row.salesAmount ?? 0).toFixed(2)),
          点击率: rate(row.clickRate),
          支付转化率: rate(row.conversionRate),
        })),
      });
      if (sampleAnalysis.funnel.length) sheets.push({
        name: '漏斗汇总',
        rows: sampleAnalysis.funnel.map((stage) => ({ 阶段: stage.label, 数量: stage.value })),
      });
      if (joinChain?.rows.length) sheets.push({ name: '匹配明细', rows: joinChain.rows.slice(0, 500) });
      const exportPeriod = dataMode === 'imported' ? '本地导入' : (sampleFixtureBundle.period?.label ?? '');
      const downloaded = await exportReportWorkbook(sheets, '分析结果-' + exportPeriod + '.xlsx');
      setExportMessage(downloaded ? '分析结果已开始下载（含 ' + sheets.length + ' 个工作表）。' : '当前环境不支持下载，请在浏览器中使用。');
    } catch (error) {
      setExportMessage('导出失败：' + error.message);
    }
  }

  function prepareAiHypothesis() {
    const settings = readSavedSettings();
    const config = settings.ai;
    const check = validateAiConfig(config ?? {});
    if (!check.valid) {
      setAiAssist({ status: 'unconfigured', message: '尚未配置可用的 AI 接口（' + check.errors.join('；') + '）。本地规则分析不受影响，可前往「设置与数据管理」填写兼容接口。', preview: null, request: null, result: '' });
      return;
    }
    if (!anomalyRows.length) {
      setAiAssist({ status: 'idle', message: '请先载入示例数据生成异常诊断，再请求 AI 假设。', preview: null, request: null, result: '' });
      return;
    }
    const hideProductId = (settings.sensitiveFields ?? []).includes('商品 ID');
    const request = buildAnomalyHypothesisRequest(anomalyRows, { hideProductId });
    setAiAssist({
      status: 'awaiting-confirm',
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
      result: '',
    });
  }

  async function confirmAiHypothesis() {
    if (aiAssist.status !== 'awaiting-confirm' || !aiAssist.request) return;
    setAiAssist({ ...aiAssist, status: 'loading' });
    try {
      const text = await callChatCompletion(readSavedSettings().ai ?? {}, { messages: aiAssist.request.messages, maxTokens: 300, timeoutMs: 30000 });
      setAiAssist({ status: 'done', message: '', preview: null, request: null, result: text });
    } catch (error) {
      setAiAssist({ status: 'error', message: error.message, preview: null, request: null, result: '' });
    }
  }

  function createProject() {
    const name = projectDraft.name.trim();
    if (!name) { setProjectNotice('请先填写项目名称。'); return; }
    const now = new Date().toISOString();
    // PRD §8.1/§18：项目连同导入数据副本、字段映射和分析配置一起持久化，刷新后可继续。
    const project = createAnalysisProject({
      name,
      period: projectDraft.periodStart && projectDraft.periodEnd ? projectDraft.periodStart + ' ~ ' + projectDraft.periodEnd : (projectDraft.periodStart || '未设置'),
      site: projectDraft.site,
      categoryRange: projectDraft.categoryRange.trim() || '未设置',
      status: '进行中',
      progress: 0,
      createdAt: now,
      snapshot: buildAnalysisSnapshot({ importedFiles, fieldMapping: manualMapping, analysisConfig: analysisFilters, dataMode }),
    });
    try {
      saveAnalysisProject(project, window.localStorage);
      setCurrentProjectId(project.id);
      setProjectFormOpen(false);
      setProjectDraft({ name: '', periodStart: '', periodEnd: '', site: 'US', categoryRange: '' });
      setProjectNotice('');
      const sizeLabel = formatBytes(estimateProjectBytes(project));
      setNotice(`已创建并保存项目「${name}」（本地占用约 ${sizeLabel}），可在「历史项目」中查看、复制或删除。`);
    } catch (error) {
      setProjectNotice('保存失败：' + error.message);
    }
  }
  const sampleAnalysis = useMemo(() => {
    if (!loaded || dataMode !== 'sample') {
      if (dataMode === 'imported' && filteredImportedRows.length) return { pivot: buildPivot(filteredImportedRows, { groupBy: 'category', measures: ['impressions', 'clicks', 'paid', 'salesAmount'] }), funnel: buildFunnel(filteredImportedRows) };
      return { pivot: [], funnel: [] };
    }
    // 从数据推导最新统计日，避免换样例数据后透视口径过期
    const latestDate = sampleFixtureBundle.tables.sales.rows.reduce((max, row) => (String(row.date ?? '') > max ? String(row.date) : max), '');
    const products = new Map(sampleFixtureBundle.tables.products.rows.map((row) => [row.productId, row]));
    const categories = new Map(sampleFixtureBundle.tables.categories.rows.map((row) => [row.categoryId, row.categoryNameZh]));
    const sales = new Map(sampleFixtureBundle.tables.sales.rows.filter((row) => row.date === latestDate).map((row) => [row.productId, row]));
    const rows = sampleFixtureBundle.tables.traffic.rows.filter((row) => row.date === latestDate).map((row) => {
      const product = products.get(row.productId) ?? {};
      const sale = sales.get(row.productId) ?? {};
      return { ...row, category: categories.get(product.categoryId) ?? product.categoryId ?? '未分类', paid: sale.orders, addToCart: sale.addToCart, salesAmount: sale.revenue };
    });
    return { pivot: buildPivot(rows, { groupBy: 'category', measures: ['impressions', 'clicks', 'paid', 'salesAmount'] }), funnel: buildFunnel(rows) };
  }, [loaded, dataMode]);

  function loadSample() {
    setLoaded(true);
    setDataMode('sample');
    setSelectedTable('sales');
    setNotice(`已载入 ${sampleTables.length} 张示例表，可以从销售明细开始检查字段和匹配关系。`);
  }

  async function handleFiles(event) {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    const MAX_IMPORT_ROWS = 100000; // PRD §8.2：超大文件先截断并提示，避免浏览器卡死
    const sheets = [];
    const failedFiles = [];
    let truncated = false;
    // 逐文件解析：单个文件失败只记录该文件，其余文件照常导入（PRD §8.2 容错）。
    for (const file of files) {
      try {
        const parsed = file.name.toLowerCase().endsWith('.csv')
          ? await parseSpreadsheet(await file.text(), { format: 'csv', name: file.name })
          : await parseSpreadsheet(file);
        if (!parsed.length) { failedFiles.push(`${file.name}（没有可读取的工作表）`); continue; }
        for (const sheet of parsed) {
          if (sheet.rows.length > MAX_IMPORT_ROWS) {
            truncated = true;
            sheets.push({ ...sheet, rows: sheet.rows.slice(0, MAX_IMPORT_ROWS), fileName: file.name });
          } else {
            sheets.push({ ...sheet, fileName: file.name });
          }
        }
      } catch (error) {
        failedFiles.push(`${file.name}（${error.message}）`);
      }
    }
    if (sheets.length) {
      setImportedFiles(sheets);
      setLoaded(true);
      setDataMode('imported');
      setSelectedTable('imported:0');
      const failureNote = failedFiles.length ? `；${failedFiles.length} 个文件失败：${failedFiles.join('、')}` : '';
      setNotice(`已读取 ${sheets.length} 个工作表：${sheets.map((sheet) => sheet.name).join('、')}${failureNote}。${truncated ? `单表超过 ${MAX_IMPORT_ROWS} 行，已截断以保持流畅。` : '当前先展示导入预览，确认字段后再匹配。'}`);
    } else {
      setNotice(`导入失败：${failedFiles.join('、') || '没有可读取的文件'}`);
    }
    event.target.value = '';
  }

  return (
    <main className="analysis-workspace" data-testid="analysis-workspace">
      <section className="workspace-hero glass-card">
        <div><span className="eyebrow"><BarChart3 size={14} /> MVP · 商品数据分析</span><h1>先把数据变成能解释的结论。</h1><p>从导入、字段匹配到质量检查，每一步都保留证据，方便你在 Excel 里复现。</p></div>
        <div className="workspace-actions">
          <button className="primary-button" onClick={loadSample} data-tutorial="sample-data"><Sparkles size={16} /> 载入示例数据</button>
          <label className="secondary-button" data-tutorial="import"><Upload size={16} /> 导入 Excel / CSV<input type="file" accept=".xlsx,.xls,.csv" multiple hidden onChange={handleFiles} /></label>
          <button className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setProjectFormOpen((open) => !open)}><FolderPlus size={16} /> 新建分析项目</button>
        </div>
      </section>

      {projectFormOpen && (
        <section className="panel-card glass-card" data-testid="project-form">
          <div className="panel-heading"><div><span className="section-kicker">NEW PROJECT · PRD §8.1</span><h2>新建分析项目</h2></div><span className="soft-status">保存到本机历史项目</span></div>
          <p className="panel-help">项目保存到「历史项目」；后续的字段映射、匹配链路和规则阈值都会随项目保留，可复制到下一周。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <label style={{ fontSize: 12, color: '#5f4d59', display: 'grid', gap: 4 }}>项目名称 *<input style={formInputStyle} value={projectDraft.name} onChange={(event) => setProjectDraft({ ...projectDraft, name: event.target.value })} placeholder="2026 年第 35 周商品经营分析" /></label>
            <label style={{ fontSize: 12, color: '#5f4d59', display: 'grid', gap: 4 }}>周期开始<input type="date" style={formInputStyle} value={projectDraft.periodStart} onChange={(event) => setProjectDraft({ ...projectDraft, periodStart: event.target.value })} /></label>
            <label style={{ fontSize: 12, color: '#5f4d59', display: 'grid', gap: 4 }}>周期结束<input type="date" style={formInputStyle} value={projectDraft.periodEnd} onChange={(event) => setProjectDraft({ ...projectDraft, periodEnd: event.target.value })} /></label>
            <label style={{ fontSize: 12, color: '#5f4d59', display: 'grid', gap: 4 }}>站点<select style={formInputStyle} value={projectDraft.site} onChange={(event) => setProjectDraft({ ...projectDraft, site: event.target.value })}><option>US</option><option>UK</option><option>CA</option><option>DE</option><option>其他</option></select></label>
            <label style={{ fontSize: 12, color: '#5f4d59', display: 'grid', gap: 4 }}>品类范围<input style={formInputStyle} value={projectDraft.categoryRange} onChange={(event) => setProjectDraft({ ...projectDraft, categoryRange: event.target.value })} placeholder="女装 / 全品类…" /></label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
            <button className="primary-button" onClick={createProject}>创建并保存</button>
            <button className="secondary-button" onClick={() => { setProjectFormOpen(false); setProjectNotice(''); }}>取消</button>
            {projectNotice && <small style={{ color: '#96707f' }}>{projectNotice}</small>}
          </div>
        </section>
      )}

      {productDrilldown && <ProductDrilldown productId={selectedProductId} totals={productDrilldown.totals} rowCount={productDrilldown.rows.length} onClose={() => setSelectedProductId('')} />}

      {dataMode === 'imported' && importedAnalysis.rows.length > 0 && (
        <section className="panel-card glass-card" style={{ padding: '12px 16px', marginBottom: 12 }} data-testid="analysis-filters">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 12 }}>
            <strong>筛选：</strong>
            <label>开始日期 <input type="date" value={analysisFilters.dateFrom} onChange={(event) => setAnalysisFilters({ ...analysisFilters, dateFrom: event.target.value })} /></label>
            <label>结束日期 <input type="date" value={analysisFilters.dateTo} onChange={(event) => setAnalysisFilters({ ...analysisFilters, dateTo: event.target.value })} /></label>
            <label>品类
              <select value={analysisFilters.category} onChange={(event) => setAnalysisFilters({ ...analysisFilters, category: event.target.value })}>
                <option value="">全部</option>
                {importedCategories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label className="history-toggle" title="同商品同日期的重复行自动累加，避免多份日报重叠统计"><input type="checkbox" checked={incrementalMerge} onChange={(event) => setIncrementalMerge(event.target.checked)} />增量合并</label>
            <span style={{ color: '#96707f' }}>当前 {filteredImportedRows.length} / {importedAnalysis.rows.length} 行{importedAnalysis.mergedCount > 0 ? ` · 已合并 ${importedAnalysis.mergedCount} 条重复` : ''}</span>
            <button className="text-button" onClick={() => setAnalysisFilters({ dateFrom: '', dateTo: '', category: '' })}>清除筛选</button>
          </div>
          {importedComparison.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {importedComparison.map((item) => (
                <span key={item.metric} className="soft-status">{item.metric}：{item.previous.toLocaleString()} → {item.current.toLocaleString()}（{item.changeLabel}）</span>
              ))}
            </div>
          )}
          {importedTrend.length > 1 && importedTrendPoints && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, color: '#5f4d59', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>销售额趋势（按日期，共 {importedTrend.length} 天）</span>
                <button className="text-button" onClick={exportTrendPng}>存为图片</button>
              </div>
              {(() => {
                const geometry = buildSparklineGeometry(importedTrend.map((point) => point.value), { width: 240, height: 48 });
                return (
                  <svg id="analysis-trend-svg" viewBox="0 0 240 48" width="100%" height="48" role="img" aria-label="销售额趋势折线图">
                    <polyline points={importedTrendPoints} fill="none" stroke="#b36587" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    {geometry.map((point) => {
                      const info = importedTrend[point.index];
                      const label = annotations[info?.date];
                      return label ? <circle key={info.date} cx={point.x} cy={point.y} r={3.5} fill="#3a9d6d"><title>{info.date} · {label}</title></circle> : null;
                    })}
                  </svg>
                );
              })()}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginTop: 8 }}>
                <input type="date" value={annotationDraft.date} onChange={(event) => setAnnotationDraft({ ...annotationDraft, date: event.target.value })} style={{ fontSize: 12 }} />
                <input type="text" placeholder="事件标签，如：大促 / 断货" value={annotationDraft.label} onChange={(event) => setAnnotationDraft({ ...annotationDraft, label: event.target.value })} onKeyDown={(event) => event.key === 'Enter' && commitAnnotation()} style={{ flex: '1 1 140px', fontSize: 12 }} />
                <button className="text-button" onClick={commitAnnotation}>添加标注</button>
              </div>
              {Object.keys(annotations).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {Object.entries(annotations).map(([date, label]) => (
                    <span key={date} className="soft-status">{date} · {label}<button className="text-button" aria-label={'删除标注' + date} onClick={() => removeAnnotation(date)} style={{ marginLeft: 4 }}>✕</button></span>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      )}
      <div className="analysis-grid">
        <section className="panel-card glass-card" data-tutorial="field-mapping"><div className="panel-heading"><div><span className="section-kicker">STEP 01</span><h2>选择数据表</h2></div><span className="soft-status">{loaded ? (dataMode === 'imported' ? '真实导入' : '示例模式') : '待开始'}</span></div><p className="panel-help">先选一张表查看字段、示例值和数据质量；导入的文件只在本机处理。</p><div className="table-picker">{availableTables.filter((item) => dataMode === 'sample' ? item.source === 'sample' : item.source === 'imported').map((item) => <button key={item.tableId} className={selectedTable === item.tableId ? 'table-chip is-selected' : 'table-chip'} onClick={() => setSelectedTable(item.tableId)}>{item.label}<small>{item.rows.length} 行</small></button>)}</div><div className="notice-box"><CircleHelp size={16} /> {notice}</div></section>
        <section className="panel-card glass-card" data-tutorial="quality-check"><div className="panel-heading"><div><span className="section-kicker">STEP 02</span><h2>数据质量检查</h2></div><span className="soft-status success">已检查</span></div><div className="quality-summary"><strong>{quality.issues.length === 0 ? '这张表暂未发现结构问题' : `发现 ${quality.issues.length} 个需要留意的问题`}</strong><div className="quality-items"><span>行数 {quality.rowCount}</span><span>字段 {quality.columnCount}</span><span>空值列 {quality.missingByColumn.length}</span></div></div></section>
        <section className="panel-card glass-card" data-tutorial="joins"><div className="panel-heading"><div><span className="section-kicker">STEP 03</span><h2>多表连续匹配</h2></div><span className="soft-status">VLOOKUP / XLOOKUP</span></div>{dataMode === 'sample' && joinChain ? <div className="join-report"><div style={{ display: 'grid', gap: 8 }}>{joinChain.reports.map((step) => <article key={step.step} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px', background: 'rgba(255,255,255,.66)' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><strong style={{ fontSize: 13 }}>{step.label}</strong><code style={{ fontSize: 11 }}>{step.matchedBy}</code></div><small style={{ color: '#96707f' }}>输出 {step.outputRowCount} 行 · 未匹配 {step.unmatchedPrimaryKeys.length} · 重复键 {step.duplicateSecondaryKeys.length}{step.rowCountInflation > 0 ? ' · 行数膨胀 +' + step.rowCountInflation : ''}</small></article>)}</div><div style={{ marginTop: 8, fontSize: 12, color: '#5f4d59' }}>连续匹配最终输出 <strong>{joinChain.rows.length}</strong> 行，每一步确认后再继续下一步。</div></div> : (dataMode === 'imported' && importedSheetOptions.length >= 2 ? (
          <div style={{ display: 'grid', gap: 8 }} data-testid="import-join-editor">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
              <select aria-label="主表" value={joinPlan?.primaryId ?? ''} onChange={(event) => setJoinPlan({ primaryId: event.target.value, secondaryId: joinPlan?.secondaryId ?? '', primaryKey: '', secondaryKey: '' })}>
                <option value="">选择主表</option>
                {importedSheetOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <select aria-label="关联表" value={joinPlan?.secondaryId ?? ''} onChange={(event) => setJoinPlan({ ...joinPlan, primaryId: joinPlan?.primaryId ?? '', secondaryId: event.target.value, primaryKey: '', secondaryKey: '' })}>
                <option value="">选择关联表</option>
                {importedSheetOptions.filter((option) => option.id !== joinPlan?.primaryId).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              {joinPrimary && <select aria-label="主表关联键" value={joinPlan?.primaryKey ?? ''} onChange={(event) => setJoinPlan({ ...joinPlan, primaryKey: event.target.value, secondaryKey: joinKeySuggestions[0]?.left === event.target.value ? joinKeySuggestions[0].right : joinPlan?.secondaryKey ?? '' })}>
                <option value="">主表关联键</option>
                {(joinPrimary.headers ?? []).map((header) => <option key={header} value={header}>{header}</option>)}
              </select>}
              {joinSecondary && <select aria-label="关联表键" value={joinPlan?.secondaryKey ?? ''} onChange={(event) => setJoinPlan({ ...joinPlan, secondaryKey: event.target.value })}>
                <option value="">关联表键</option>
                {(joinSecondary.headers ?? []).map((header) => <option key={header} value={header}>{header}</option>)}
              </select>}
            </div>
            {joinKeySuggestions.length > 0 && <div style={{ fontSize: 11, color: '#96707f' }}>推荐关联键：{joinKeySuggestions.map((item) => `${item.left} ↔ ${item.right}`).join('、')}</div>}
            {joinPreview && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px', background: 'rgba(255,255,255,.66)', fontSize: 12 }}>
                匹配输出 <strong>{joinPreview.outputRowCount}</strong> 行 · 未匹配 {joinPreview.unmatched} · 重复键 {joinPreview.duplicates}
              </div>
            )}
          </div>
        ) : (<div className="empty-state"><Boxes size={26} /><span>{dataMode === 'imported' ? '导入两张以上工作表后，可以选择主表和关联键进行多表匹配预览。' : '载入示例数据会演示 销售 → 商品 → 品类 → 供应商 的连续匹配。'}</span></div>))}<p className="formula-hint">复现公式：<code>=XLOOKUP(A2, 商品表!A:A, 商品表!B:B, "未匹配")</code></p></section>
        <section className="panel-card glass-card" data-tutorial="diagnosis"><div className="panel-heading"><div><span className="section-kicker">STEP 04</span><h2>字段推荐与预览</h2></div><Sparkles size={18} color="#c45880" /></div><div className="mapping-list">{mapping.map((item) => <div className="mapping-row" key={item.target}><span>{item.target}</span><ArrowRight size={14} /><strong>{item.source ?? '未匹配'}</strong><small>{Math.round(item.confidence * 100)}%</small></div>)}</div><div className="preview-table-wrap"><table><thead><tr>{preview.headers.slice(0, 4).map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{preview.rows.slice(0, 3).map((row, index) => <tr key={index}>{preview.headers.slice(0, 4).map((header) => <td key={header}>{String(row[header] ?? '—')}</td>)}</tr>)}</tbody></table></div>{dataMode === 'imported' && importedHeaders.length > 0 && (
          <div style={{ marginTop: 10, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
            <div style={{ fontSize: 12, marginBottom: 6 }}><strong>手动字段映射</strong><small style={{ color: '#96707f', marginLeft: 6 }}>留空表示使用自动识别</small></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
              {mappingTargets.map((target) => (
                <label key={target.key} style={{ fontSize: 11, display: 'grid', gap: 3 }}>
                  {target.label}
                  <select value={manualMapping[target.key] ?? ''} onChange={(event) => setManualField(target.key, event.target.value)}>
                    <option value="">自动识别</option>
                    {importedHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
              ))}
            </div>
            {Object.keys(manualMapping).length > 0 && <button className="text-button" style={{ marginTop: 6 }} onClick={() => setManualMapping({})}>恢复自动识别</button>}
          </div>
        )}
</section>
        <section className="panel-card glass-card diagnosis-panel" data-tutorial="rules"><div className="panel-heading"><div><span className="section-kicker">STEP 05</span><h2>异常与策略诊断</h2></div><span className="ai-badge"><Sparkles size={13} /> AI 只提假设</span></div>{dataMode === 'imported' && filteredImportedRows.length > 0 && (
          <div style={{ marginBottom: 12, border: '1px dashed var(--line)', borderRadius: 12, padding: 10 }} data-testid="rule-editor">
            <div style={{ fontSize: 12, marginBottom: 6 }}><strong>自定义异常规则</strong><small style={{ color: '#96707f', marginLeft: 6 }}>命中结果与默认规则并列展示</small></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
              <select aria-label="规则指标" value={ruleDraft.metric} onChange={(event) => setRuleDraft({ ...ruleDraft, metric: event.target.value })}>{Object.entries(ruleMetricLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select aria-label="比较方式" value={ruleDraft.operator} onChange={(event) => setRuleDraft({ ...ruleDraft, operator: event.target.value })}><option value="lt">小于</option><option value="gte">不小于</option></select>
              <input aria-label="阈值" type="number" step="any" style={{ width: 90 }} value={ruleDraft.threshold} onChange={(event) => setRuleDraft({ ...ruleDraft, threshold: event.target.value })} />
              <button className="text-button" onClick={addRule}>添加规则</button>
            </div>
            {customRules.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {customRules.map((rule, index) => <span key={rule.id} className="soft-status">{rule.label}<button aria-label={`删除规则${index}`} style={{ marginLeft: 4 }} onClick={() => setCustomRules((current) => current.filter((item) => item.id !== rule.id))}>×</button></span>)}
              </div>
            )}
            {customRuleHits.length > 0 && <div style={{ marginTop: 8, fontSize: 12 }}>规则命中：{customRuleHits.map((hit) => `${hit.productId}（${ruleMetricLabels[hit.rule] ?? hit.ruleLabel ?? hit.rule}）`).join('、')}</div>}
          </div>
        )}{diagnostics.length ? <div className="diagnostic-list">{diagnostics.map((item) => <article className="diagnostic-row" key={item.id}><div className="diagnostic-top"><strong>{item.finding}</strong><span className="priority-tag">{item.priority}</span></div><p>证据：曝光 {item.evidence.values.impressions.toLocaleString()}，点击率 {(item.evidence.values.clickRate * 100).toFixed(2)}%，转化率 {(item.evidence.values.conversionRate * 100).toFixed(2)}%</p><small>{item.suggestedAction}</small>{loaded && (
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            {item.productId && <button className="text-button" onClick={() => setSelectedProductId(item.productId)}>查看商品详情</button>}
            <button className="text-button" disabled={convertedDiagnostics.includes(item.id + ':task')} onClick={() => convertToTask(item)}>{convertedDiagnostics.includes(item.id + ':task') ? '已加入任务' : '转日常任务'}</button>
            <button className="text-button" disabled={convertedDiagnostics.includes(item.id + ':issue')} onClick={() => convertToIssue(item, item.productId)}>{convertedDiagnostics.includes(item.id + ':issue') ? '已加入问题' : '转供应商问题'}</button>
          </div>
        )}</article>)}</div> : <div className="empty-state"><AlertTriangle size={26} /><span>{dataMode === 'imported' ? (importedAnalysis.reason || '当前导入数据暂未触发异常规则。') : '载入示例数据后，系统会根据规则生成可复核的异常诊断。'}</span></div>}
          <div style={{ marginTop: 12, borderTop: '1px dashed var(--line)', paddingTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={prepareAiHypothesis} disabled={aiAssist.status === 'loading'}><Sparkles size={14} /> AI 原因假设</button>
              <small style={{ color: '#96707f' }}>发送前显示脱敏预览，需手动放行</small>
            </div>
            {aiAssist.status === 'unconfigured' && <p className="panel-help">{aiAssist.message}</p>}
            {aiAssist.status === 'idle' && aiAssist.message && <p className="panel-help">{aiAssist.message}</p>}
            {aiAssist.status === 'awaiting-confirm' && (
              <div data-testid="ai-preview" style={{ marginTop: 8, border: '1px solid var(--line)', borderRadius: 12, padding: 10, background: 'rgba(255,255,255,.66)' }}>
                <div style={{ fontSize: 12 }}>目标接口：<code>{aiAssist.preview.endpoint}</code> · 模型 <code>{aiAssist.preview.model}</code></div>
                <div style={{ fontSize: 12, marginTop: 4 }}>发送字段：{aiAssist.preview.fields}（共 {aiAssist.preview.rowCount} 行{aiAssist.preview.hidden ? '；商品 ID 已按隐私设置隐藏' : '；商品 ID 已匿名化'}）</div>
                <pre style={{ margin: '6px 0', maxHeight: 120, overflow: 'auto', fontSize: 11, whiteSpace: 'pre-wrap' }}>{JSON.stringify(aiAssist.preview.rows, null, 2)}</pre>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="primary-button" onClick={confirmAiHypothesis}>确认发送</button>
                  <button className="secondary-button" onClick={() => setAiAssist({ status: 'idle', message: '已取消发送，未产生任何网络请求。', preview: null, request: null, result: '' })}>取消</button>
                </div>
              </div>
            )}
            {aiAssist.status === 'loading' && <p className="panel-help">正在请求 AI…（可随时离开页面，本地数据不受影响）</p>}
            {aiAssist.status === 'done' && (
              <div data-testid="ai-hypothesis-result" style={{ marginTop: 8 }}>
                <span className="ai-badge"><Sparkles size={13} /> AI 辅助假设 · 需人工验证</span>
                <p style={{ margin: '6px 0 0', fontSize: 13 }}>{aiAssist.result}</p>
              </div>
            )}
            {aiAssist.status === 'error' && <p className="panel-help">{aiAssist.message}（可重试；本地分析不受影响。）</p>}
          </div>
        </section>
        <section className="panel-card glass-card diagnosis-panel" data-tutorial="pivot"><div className="panel-heading"><div><span className="section-kicker">STEP 06</span><h2>品类透视与经营漏斗</h2></div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="soft-status">数据透视表</span><button className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px' }} onClick={exportAnalysisExcel}><Download size={14} /> 导出 Excel</button></div></div>{exportMessage && <p className="panel-help" role="status" data-testid="analysis-export-message">{exportMessage}</p>}{sampleAnalysis.pivot.length ? <div className="analysis-visuals"><div className="pivot-bars">{sampleAnalysis.pivot.map((item) => { const max = Math.max(...sampleAnalysis.pivot.map((row) => row.salesAmount)); return <div className="pivot-bar-row" key={item.group}><span>{item.group}</span><div><i style={{ width: `${Math.max(6, (item.salesAmount / max) * 100)}%` }} /></div><strong>¥{item.salesAmount.toFixed(0)}</strong><small>点击率 {(item.clickRate * 100).toFixed(1)}%</small></div>; })}</div><div className="funnel-view">{sampleAnalysis.funnel.map((item, index) => { const base = sampleAnalysis.funnel[0]?.value || 1; return <div key={item.key} style={{ width: `${Math.max(35, 100 - index * 17)}%` }}><strong>{item.value.toLocaleString()}</strong><span>{item.label}</span><small>{index === 0 ? '100%' : `${((item.value / base) * 100).toFixed(1)}%`}</small></div>; })}</div></div> : <div className="empty-state"><BarChart3 size={26} /><span>{dataMode === 'imported' ? '完成字段映射后，可以选择维度和指标生成透视图表。' : '载入示例数据后显示品类销售额和曝光到支付漏斗。'}</span></div>}<p className="formula-hint">Excel 复现：行 = 品类；值 = 销售额、曝光、点击、支付；计算字段 = 点击率、支付转化率。</p></section>
      </div>
      <section className="learning-strip glass-card" data-tutorial="report-export"><BookOpen size={20} /><div><strong>新手建议：先完成第 1 个练习</strong><span>{exerciseTasks[0]?.title} · {quickStartTutorial.length} 步快速引导{importedFiles.length ? ` · 已导入 ${importedFiles.length} 个工作表` : ''}</span></div><button className="text-button">打开教程 <ArrowRight size={15} /></button></section>
    </main>
  );
}

function ModulePlaceholder({ title, onHome }) {
  return (
    <main className="module-placeholder" data-testid="module-placeholder">
      <div className="placeholder-icon"><FileBarChart size={34} /></div>
      <span className="eyebrow">MODULE PREVIEW</span>
      <h1>{title}</h1>
      <p>模块已加入产品路线，后续会在这里接入对应的工作流。</p>
      <button className="primary-button" onClick={onHome}>返回首页</button>
    </main>
  );
}

function TitlePage() {
  const rows = sampleFixtureBundle.tables.titleSamples.rows;
  const products = sampleFixtureBundle.tables.products.rows;
  return <main className="analysis-workspace"><section className="workspace-hero glass-card"><div><span className="eyebrow"><Languages size={14} /> PHASE 2 · 标题优化</span><h1>让商品事实变成更清晰的标题。</h1><p>中文、英文分别生成，逐条校验，只有人工通过的候选才能导出。</p></div></section><TitleWorkspace rows={rows} products={products} onExport={(items) => window.alert(`已准备导出 ${items.length} 条已通过标题`)}/></main>;
}

function TutorialPage({ onNavigate }) {
  return <TutorialCenter module="analysis" storage={window.localStorage} onStartSampleData={() => onNavigate('商品数据分析')} onNavigate={onNavigate} />;
}

function ReportPage() {
  // 报告绑定当前项目：优先使用最近分析项目的名称/周期，明确数据来源。
  const project = (() => { try { return findLatestAnalysisProject(window.localStorage); } catch { return null; } })();
  // 报告诊断优先取项目里保存的真实分析摘要；没有项目数据时才回退示例演示。
  const summaryDiagnostics = project?.analysisSummary?.diagnostics;
  const diagnostics = summaryDiagnostics?.length
    ? summaryDiagnostics
    : (() => {
      const trafficRows = aggregateTrafficWithSales(sampleFixtureBundle.tables.traffic.rows, sampleFixtureBundle.tables.sales.rows);
      return detectAnomalies(trafficRows, { impressionQuantile: 0.7, lowClickRate: 0.035 }).slice(0, 3).map((anomaly) => buildDiagnostic(anomaly, { hypothesis: '标题卖点或主图信息可能需要进一步验证' }));
    })();
  const report = {
    id: project?.id ?? 'sample-week-2026-08-24',
    title: project?.name ?? '2026 年第 34 周商品经营分析',
    period: project?.period && project.period !== '未设置' ? project.period : sampleFixtureBundle.period.label,
    dataSource: project ? `本地项目「${project.name}」· ${project.dataSources?.length ?? 0} 个导入工作表` : '内置示例数据',
    projectId: project?.id,
    totals: project?.analysisSummary?.totals ?? {},
    comparison: summaryDiagnostics ? (project?.analysisSummary?.comparison ?? []) : [],
    diagnostics: diagnostics.map((item) => ({ ...item, evidence: `曝光 ${item.evidence.values.impressions.toLocaleString()}，点击率 ${(item.evidence.values.clickRate * 100).toFixed(2)}%`, hypothesis: item.hypothesis })),
  };
  return <ReportWorkspace report={report} />;
}

function IssuesPage({ issues, onChange }) {
  return <main className="analysis-workspace"><IssueWorkspace rows={issues} suppliers={sampleFixtureBundle.tables.suppliers.rows} products={sampleFixtureBundle.tables.products.rows} onChange={onChange} today="2026-08-22" /></main>;
}

function TasksPage({ tasks: taskRows, issues, onChange }) {
  return <TaskWorkspace tasks={taskRows} diagnostics={[]} supplierIssues={issues} onChange={onChange} />;
}

function TrendsPage({ notes, onChange }) {
  return <TrendWorkspace rows={notes} products={sampleFixtureBundle.tables.products.rows} categories={sampleFixtureBundle.tables.categories.rows} onChange={onChange} />;
}

function TemplatesPage({ templates, onChange }) {
  return <TemplateCenter initialTemplates={templates} onChange={onChange} />;
}

function SettingsPage({ tasks, issues, templates }) {
  return <SettingsWorkspace storage={window.localStorage} dataSnapshot={{ tasks, issues, templates }} />;
}

export default function App() {
  const [active, setActive] = useState('首页');
  const [theme, setTheme] = useState(() => { try { return window.localStorage.getItem('merch-workbench:theme') || 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = theme; try { window.localStorage.setItem('merch-workbench:theme', theme); } catch {} }, [theme]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const [savedTasks, setSavedTasks] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('merch-workbench:tasks') || '[]');
      return materializeRecurringTasks(stored);
    } catch { return []; }
  });
  useEffect(() => {
    try {
      const last = window.localStorage.getItem(WEEKLY_BACKUP_META_KEY);
      if (!shouldRunWeeklyBackup(last)) return;
      const snapshot = collectFullBackup(window.localStorage);
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'workbench-weekly-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      link.click();
      URL.revokeObjectURL(url);
      window.localStorage.setItem(WEEKLY_BACKUP_META_KEY, new Date().toISOString());
    } catch { /* 自动备份失败不阻塞工作台 */ }
  }, []);
  const [savedIssues, setSavedIssues] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('merch-workbench:issues') || '[]');
      return stored.length ? stored : sampleFixtureBundle.tables.supplierIssues.rows;
    } catch { return sampleFixtureBundle.tables.supplierIssues.rows; }
  });
  const openSupplierIssueCount = savedIssues.filter((item) => item.status !== '已解决' && item.status !== '已关闭').length;
  // 顶栏通知：真实逾期数量（任务 + 供应商问题），不再只是装饰性红点。
  const today = new Date().toISOString().slice(0, 10);
  const overdueTaskCount = savedTasks.filter((item) => item.dueDate && String(item.dueDate).slice(0, 10) < today && item.status !== '已完成' && item.status !== '已取消').length;
  const overdueIssueCount = savedIssues.filter((item) => item.dueDate && String(item.dueDate).slice(0, 10) < today && item.status !== '已解决' && item.status !== '已关闭').length;
  const notificationCount = overdueTaskCount + overdueIssueCount;
  const [savedNotes, setSavedNotes] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem('merch-workbench:trends') || '[]');
      return stored.length ? stored : sampleFixtureBundle.tables.trendNotes.rows;
    } catch { return sampleFixtureBundle.tables.trendNotes.rows; }
  });
  const [savedTemplates, setSavedTemplates] = useState(() => {
    try { return JSON.parse(window.localStorage.getItem('merch-workbench:templates') || '[]'); } catch { return []; }
  });

  function updateTasks(next) {
    const manual = next.filter((item) => !item.source || item.source === 'manual');
    const materialized = materializeRecurringTasks(manual);
    setSavedTasks(materialized);
    window.localStorage.setItem('merch-workbench:tasks', JSON.stringify(materialized));
  }

  function updateIssues(next) {
    setSavedIssues(next);
    window.localStorage.setItem('merch-workbench:issues', JSON.stringify(next));
  }

  function updateNotes(next) {
    setSavedNotes(next);
    window.localStorage.setItem('merch-workbench:trends', JSON.stringify(next));
  }

  function updateTemplates(next) {
    setSavedTemplates(next);
    window.localStorage.setItem('merch-workbench:templates', JSON.stringify(next));
  }

  const paletteItems = (() => {
    const pages = navigation.map((item) => item.label);
    const pageItems = pages.map((page) => ({ id: 'page-' + page, label: page, hint: '页面', keywords: page, action: () => setActive(page) }));
    const taskItems = savedTasks.map((task) => ({ id: 'task-' + (task.id ?? task.title), label: task.title || '未命名任务', hint: '任务 · ' + (task.status ?? ''), keywords: task.category ?? '', action: () => setActive('日常任务') }));
    const issueItems = savedIssues.map((issue) => ({ id: 'issue-' + (issue.id ?? issue.title), label: issue.title || issue.finding || '供应商问题', hint: '问题 · ' + (issue.status ?? ''), keywords: '供应商问题', action: () => setActive('供应商问题') }));
    return [...pageItems, ...taskItems, ...issueItems];
  })();

  return (
    <div className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Sidebar active={active} onSelect={setActive} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} supplierIssueCount={openSupplierIssueCount} />

      <div className="app-content">
        <header className="topbar glass-panel">
          <button className="icon-button menu-button" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><Menu size={20} /></button>
          <div className="breadcrumb"><span>工作台</span><ChevronRight size={15} /><strong>{active}</strong></div>
          <label className="search-box">
            <Search size={17} />
            <input aria-label="搜索" placeholder="搜索项目、报告或帮助…" />
            <kbd>⌘ K</kbd>
          </label>
          <div className="topbar-actions">
            <button className="icon-button" onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? '切换浅色模式' : '切换深色模式'} title={theme === 'dark' ? '浅色模式' : '深色模式'}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-button notification-button" aria-label={notificationCount > 0 ? `通知：${notificationCount} 项逾期` : '通知'} title={notificationCount > 0 ? `${overdueTaskCount} 项逾期任务 · ${overdueIssueCount} 个逾期供应商问题` : '暂无逾期'}><Bell size={19} />{notificationCount > 0 && <em className="notify-count" style={{ position: 'absolute', top: -4, right: -4, fontSize: 10, fontStyle: 'normal', color: 'white', background: '#e75f91', borderRadius: 9, minWidth: 16, height: 16, display: 'grid', placeItems: 'center' }}>{notificationCount}</em>}{notificationCount === 0 && <span />}</button>
            <div className="avatar">CZ</div>
          </div>
        </header>
        <ErrorBoundary key={active}>{active === '首页' ? <Dashboard onNavigate={setActive} savedTasks={savedTasks} savedIssues={savedIssues} /> : active === '商品数据分析' ? <AnalysisWorkspace onAddTask={(task) => updateTasks([{ ...task, source: 'manual' }, ...savedTasks])} onAddIssue={(issue) => updateIssues([{ ...issue }, ...savedIssues])} /> : active === '标题优化' ? <TitlePage /> : active === '热点与选品' ? <TrendsPage notes={savedNotes} onChange={updateNotes} /> : active === '供应商问题' ? <IssuesPage issues={savedIssues} onChange={updateIssues} /> : active === '日常任务' ? <TasksPage tasks={savedTasks} issues={savedIssues} onChange={updateTasks} /> : active === '周报与报告' ? <ReportPage /> : active === '历史项目' ? <HistoryWorkspace storage={window.localStorage} /> : active === '模板中心' ? <TemplatesPage templates={savedTemplates} onChange={updateTemplates} /> : active === '教程与帮助' ? <TutorialPage onNavigate={setActive} /> : active === '设置与数据管理' ? <SettingsPage tasks={savedTasks} issues={savedIssues} templates={savedTemplates} /> : <ModulePlaceholder title={active} onHome={() => setActive('首页')} />}</ErrorBoundary>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
    </div>
  );
}
