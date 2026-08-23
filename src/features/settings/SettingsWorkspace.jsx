import { useMemo, useState } from 'react';
import { Check, Database, Download, Eye, EyeOff, KeyRound, Palette, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import {
  PROVIDER_PRESETS,
  buildClearDataTargets,
  maskSensitiveValue,
  normalizeAiConfig,
  normalizeVisualSettings,
  sanitizeSettingsForExport,
  toggleSensitiveField,
  validateAiConfig,
} from './index.js';
import { buildChatEndpoint, testConnection as requestAiConnection } from '../../lib/ai/index.js';
import './settings-workspace.css';

const DEFAULT_SENSITIVE_FIELDS = ['商品 ID', '供应商名称', '内部编码', '价格'];

function readSettings(storage) {
  if (!storage) return {};
  try { return JSON.parse(storage.getItem('merch-workbench-settings') || '{}'); } catch { return {}; }
}

export default function SettingsWorkspace({ storage: storageProp, dataSnapshot = {}, onChange }) {
  const storage = storageProp ?? (typeof window !== 'undefined' ? window.localStorage : null);
  const stored = useMemo(() => readSettings(storage), [storage]);
  const [ai, setAi] = useState(() => normalizeAiConfig(stored.ai));
  const [visual, setVisual] = useState(() => normalizeVisualSettings(stored.visual));
  const [sensitiveFields, setSensitiveFields] = useState(() => stored.sensitiveFields ?? DEFAULT_SENSITIVE_FIELDS);
  const [showKey, setShowKey] = useState(false);
  const [connectionState, setConnectionState] = useState('未测试');
  const [testing, setTesting] = useState(false);
  const [clearTargets, setClearTargets] = useState(() => buildClearDataTargets(dataSnapshot));
  const [message, setMessage] = useState('配置只保存在本机；点击「测试连接」才会向接口发起一次真实请求。');

  const persist = (next) => {
    try { storage?.setItem('merch-workbench-settings', JSON.stringify(next)); } catch { /* read-only preview */ }
    onChange?.(next);
  };

  const updateAi = (next) => { setAi(next); persist({ ai: next, visual, sensitiveFields }); };
  const updateVisual = (next) => { setVisual(next); persist({ ai, visual: next, sensitiveFields }); };
  const updateSensitive = (next) => { setSensitiveFields(next); persist({ ai, visual, sensitiveFields: next }); };
  const runConnectionTest = async () => {
    const result = validateAiConfig(ai);
    if (!result.valid) {
      setConnectionState('需要修正');
      setMessage(result.errors.join('；'));
      return;
    }
    setTesting(true);
    setConnectionState('测试中…');
    setMessage('正在请求 ' + buildChatEndpoint(ai.baseUrl) + ' …');
    const outcome = await requestAiConnection(ai);
    setTesting(false);
    if (outcome.ok) {
      setConnectionState('连接成功');
      setMessage('接口连通：' + outcome.endpoint + ' · 模型「' + ai.model + '」回复：' + outcome.reply);
    } else {
      setConnectionState('连接失败');
      setMessage(outcome.error + '。请检查地址、Key 或网络后重试；本地规则分析不受影响。');
    }
  };
  const exportSettings = () => {
    const payload = JSON.stringify(sanitizeSettingsForExport({ ai, visual, sensitiveFields }), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'merch-workbench-settings.json'; anchor.click(); URL.revokeObjectURL(url);
    setMessage('设置模板已导出，API Key 已自动剔除。');
  };
  const toggleTarget = (id) => setClearTargets((items) => items.map((item) => item.id === id ? { ...item, selected: !item.selected } : item));
  const requestClear = () => {
    const selected = clearTargets.filter((item) => item.selected);
    setMessage(selected.length ? `已选择清理 ${selected.map((item) => item.label).join('、')}。请在确认后由上层工作区执行清理。` : '请先选择要清理的数据范围。');
  };

  return (
    <main className="settings-workspace" data-testid="settings-workspace">
      <section className="settings-hero glass-card">
        <div><span className="eyebrow"><ShieldCheck size={14} /> SETTINGS · 本地配置</span><h1>设置与数据管理</h1><p>管理 AI 辅助、隐私脱敏和工作台视觉偏好。所有操作都留在当前设备。</p></div>
        <button className="secondary-button" onClick={exportSettings}><Download size={15} />导出设置模板</button>
      </section>

      <p className="settings-message" role="status">{message}</p>

      <section className="settings-grid">
        <article className="settings-panel glass-card">
          <div className="settings-panel-heading"><div><span className="section-kicker">AI ASSISTANT</span><h2>兼容接口配置</h2></div><Sparkles size={18} color="#b85b81" /></div>
          <p className="settings-help">AI 只接收你手动放行的摘要，不会自动上传原始表格。测试连接仅检查格式。</p>
          <label className="settings-field">服务商<select value={ai.provider} onChange={(event) => updateAi(normalizeAiConfig({ ...ai, provider: event.target.value, baseUrl: undefined, model: undefined }))}>{Object.entries(PROVIDER_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select></label>
          <label className="settings-field">接口地址<input value={ai.baseUrl} onChange={(event) => updateAi({ ...ai, baseUrl: event.target.value })} placeholder="https://api.example.com/v1" /></label>
          <label className="settings-field">模型名称<input value={ai.model} onChange={(event) => updateAi({ ...ai, model: event.target.value })} placeholder="model-name" /></label>
          <label className="settings-field">API Key<div className="secret-input"><KeyRound size={14} /><input type={showKey ? 'text' : 'password'} value={ai.apiKey} onChange={(event) => updateAi({ ...ai, apiKey: event.target.value })} placeholder="只保存在本机" /><button type="button" className="icon-button" aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} onClick={() => setShowKey((value) => !value)}>{showKey ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
          {ai.apiKey && <p className="masked-key">当前值：{maskSensitiveValue(ai.apiKey)}</p>}
          <div className="settings-actions"><button className="primary-button" disabled={testing} onClick={runConnectionTest}><Check size={15} />{testing ? '测试中…' : '测试连接'}</button><span className={`connection-state ${connectionState === '连接成功' ? 'success' : ''}`}>{connectionState}</span></div>
        </article>

        <article className="settings-panel glass-card">
          <div className="settings-panel-heading"><div><span className="section-kicker">PRIVACY</span><h2>发送前脱敏字段</h2></div><Database size={18} color="#8c65ba" /></div>
          <p className="settings-help">勾选的字段默认从 AI 请求中隐藏。你可以在每次发送前再次调整。</p>
          <div className="sensitive-list">{['商品 ID', '供应商名称', '内部编码', '价格', '销售额'].map((field) => <label key={field}><input type="checkbox" checked={sensitiveFields.includes(field)} onChange={(event) => updateSensitive(toggleSensitiveField(sensitiveFields, field, event.target.checked))} />{field}</label>)}</div>
          <div className="privacy-note"><ShieldCheck size={15} /><span>本地规则分析无需联网；导出设置和备份时会自动排除 API Key。</span></div>
        </article>

        <article className="settings-panel glass-card">
          <div className="settings-panel-heading"><div><span className="section-kicker">APPEARANCE</span><h2>视觉与动效</h2></div><Palette size={18} color="#d17a48" /></div>
          <div className="switch-list">
            <label className="switch-row"><span><strong>专注工作模式</strong><small>降低装饰透明度，让表格更突出</small></span><input type="checkbox" checked={visual.focusMode} onChange={(event) => updateVisual({ ...visual, focusMode: event.target.checked })} /></label>
            <label className="switch-row"><span><strong>减少动效</strong><small>关闭非必要的淡入、悬停和位移动画</small></span><input type="checkbox" checked={visual.reduceMotion} onChange={(event) => updateVisual({ ...visual, reduceMotion: event.target.checked })} /></label>
          </div>
        </article>

        <article className="settings-panel glass-card settings-clear-panel">
          <div className="settings-panel-heading"><div><span className="section-kicker">DATA LIFECYCLE</span><h2>清理本地数据</h2></div><Trash2 size={18} color="#c45472" /></div>
          <p className="settings-help">这里只生成待确认清单，不会直接删除。确认后由对应模块执行并提供恢复方式。</p>
          <div className="clear-list">{clearTargets.map((item) => <label key={item.id}><input type="checkbox" checked={item.selected} onChange={() => toggleTarget(item.id)} /><span>{item.label}</span><em>{item.count} 条</em></label>)}</div>
          <button className="danger-button" onClick={requestClear}><Trash2 size={14} />生成清理确认清单</button>
        </article>
      </section>
    </main>
  );
}
