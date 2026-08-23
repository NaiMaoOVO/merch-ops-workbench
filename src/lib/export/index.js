/**
 * Local report export toolkit (PRD §13.3).
 * Markdown / HTML / Word / Excel / PDF(print) — no network calls, no new deps:
 * HTML and Word reuse the rendered Markdown; Excel reuses the existing xlsx.
 * Exporters stay UI-agnostic; download helpers guard against SSR/test use.
 */

const textValue = (value, fallback = '') => (value === null || value === undefined ? fallback : String(value));

/* ---------------------------------- shared downloads ---------------------------------- */

export function canDownload() {
  return typeof document !== 'undefined' && typeof URL?.createObjectURL === 'function';
}

export function downloadBlob(blob, filename) {
  if (!canDownload()) return false;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  return downloadBlob(new Blob([textValue(text)], { type: mime }), filename);
}

/* ----------------------------- preflight completeness check ---------------------------- */

const EMPTY_TEXTS = new Set(['', '待补充']);

/**
 * PRD §13.3 — run before any export: flag unconfirmed AI hypotheses, missing
 * period and empty visible modules. Warnings inform the export; they never block it.
 */
export function preflightReport(draft, options = {}) {
  const warnings = [];
  const modules = Array.isArray(draft?.modules) ? draft.modules : [];

  const period = textValue(draft?.period ?? modules.find((module) => module.id === 'overview')?.period);
  if (!period.trim() || period.trim() === '未配置') {
    warnings.push({ code: 'period-missing', severity: 'warning', message: '报告周期未配置，导出前请在报告概览中补充。' });
  }

  for (const module of modules) {
    if (!module.visible) continue;
    if (module.kind === 'diagnostics') {
      const items = Array.isArray(module.diagnostics) ? module.diagnostics : [];
      if (!items.length) warnings.push({ code: 'empty-module', severity: 'info', message: '「' + module.title + '」暂无诊断内容。' });
      for (const item of items) {
        if (item?.hypothesis?.isAiAssisted && !item.confirmedAt) {
          warnings.push({ code: 'ai-unconfirmed', severity: 'notice', message: item.finding + '：包含 AI 辅助假设，发送前请人工确认。' });
        }
      }
    }
    if (module.kind === 'text' && EMPTY_TEXTS.has(String(module.text ?? '').trim())) {
      warnings.push({ code: 'empty-module', severity: 'info', message: '「' + module.title + '」内容为空，导出后会显示占位文字。' });
    }
  }

  const checkedAt = options.now instanceof Date ? options.now.toISOString() : textValue(options.now) || new Date().toISOString();
  return {
    warnings,
    ready: !warnings.some((item) => item.severity === 'error' || item.severity === 'warning'),
    checkedAt,
  };
}

/* ----------------------------------- markdown → html ----------------------------------- */

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/[\u0060]([^\u0060]+)[\u0060]/g, '<code>$1</code>');
}

/** Convert the workbench Markdown subset (#/##/###, lists, bold, quotes) to HTML blocks. */
export function renderMarkdownFragment(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const blocks = [];
  let listItems = null;

  const flushList = () => {
    if (listItems?.length) blocks.push('<ul>' + listItems.map((item) => '<li>' + inlineFormat(item) + '</li>').join('') + '</ul>');
    listItems = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const listMatch = /^[-*]\s+(.*)$/.exec(line.trim());
    if (listMatch) { listItems = listItems ?? []; listItems.push(listMatch[1]); continue; }
    flushList();
    if (!line.trim()) continue;
    if (line.startsWith('### ')) blocks.push('<h3>' + inlineFormat(line.slice(4)) + '</h3>');
    else if (line.startsWith('## ')) blocks.push('<h2>' + inlineFormat(line.slice(3)) + '</h2>');
    else if (line.startsWith('# ')) blocks.push('<h1>' + inlineFormat(line.slice(2)) + '</h1>');
    else if (line.startsWith('> ')) blocks.push('<blockquote>' + inlineFormat(line.slice(2)) + '</blockquote>');
    else blocks.push('<p>' + inlineFormat(line) + '</p>');
  }
  flushList();
  return blocks.join('\n');
}

/**
 * Standalone HTML document with inline sakura styles (PRD §20), carrying
 * period / rule version / generated time so every export stays traceable.
 */
export function renderReportHtml(options = {}) {
  const title = options.title || '商品经营分析报告';
  const period = options.period || '';
  const ruleVersion = options.ruleVersion || 'builtin-rules v0.1';
  const generatedAt = options.generatedAt || new Date().toISOString();
  const body = renderMarkdownFragment(options.markdown);
  const extra = options.extraBodyHtml || '';
  return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>' + escapeHtml(title) + '</title>\n<style>' +
    'body { margin: 0; padding: 40px 24px; background: #fdf7f9; color: #4a3b44; font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; line-height: 1.7; }' +
    '.report-sheet { max-width: 860px; margin: 0 auto; background: #fff; border: 1px solid rgba(214,158,178,.28); border-radius: 18px; padding: 36px 40px; box-shadow: 0 18px 44px rgba(196,88,128,.10); }' +
    'h1 { font-size: 24px; color: #c45880; margin: 0 0 6px; }' +
    'h2 { font-size: 18px; color: #b0557a; margin: 26px 0 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(196,88,128,.16); }' +
    'h3 { font-size: 15px; color: #8a5d70; margin: 18px 0 6px; }' +
    'p { margin: 8px 0; font-size: 14px; } ul { margin: 8px 0; padding-left: 22px; } li { font-size: 14px; margin: 4px 0; }' +
    'blockquote { margin: 16px 0 0; padding: 10px 14px; background: rgba(196,88,128,.07); border-left: 3px solid #d69eb2; border-radius: 8px; font-size: 12.5px; color: #96707f; }' +
    'code { background: rgba(196,88,128,.10); border-radius: 5px; padding: 1px 6px; font-size: 12.5px; }' +
    '.report-meta { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-top: 22px; padding-top: 14px; border-top: 1px dashed rgba(196,88,128,.30); font-size: 12.5px; color: #96707f; }' +
    '</style>\n</head>\n<body>\n<article class="report-sheet">\n' + body + '\n' + extra +
    '\n<footer class="report-meta"><span><strong>数据周期：</strong>' + escapeHtml(period || '未配置') + '</span>' +
    '<span><strong>规则版本：</strong>' + escapeHtml(ruleVersion) + '</span>' +
    '<span><strong>生成时间：</strong>' + escapeHtml(generatedAt) + '</span></footer>\n</article>\n</body>\n</html>';
}

/* --------------------------------------- word ----------------------------------------- */

const WORD_MIME = 'application/msword;charset=utf-8';

/** Wrap rendered HTML as a .doc payload Word/WPS open natively. */
export function buildWordBlob(html) {
  const inner = String(html ?? '').replace(/^[\s\S]*?<body[^>]*>/, '').replace(/<\/body>\s*<\/html>\s*$/, '');
  const prefix = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body>';
  return new Blob([prefix + inner + "</body></html>"], { type: WORD_MIME });
}

export function exportWordDocument(html, filename) {
  const name = filename || '商品经营分析报告.doc';
  return downloadBlob(buildWordBlob(html), name.endsWith('.doc') ? name : name + '.doc');
}

/* ---------------------------------------- pdf ------------------------------------------ */

/** Open a print window for the HTML report — browsers save it as PDF. */
export function printReportHtml(html, options = {}) {
  if (typeof window === 'undefined' || typeof window.open !== 'function') return false;
  const printWindow = window.open('', '_blank', 'width=900,height=720');
  if (!printWindow) return false;
  printWindow.document.write(String(html ?? ''));
  printWindow.document.title = options.title || '商品经营分析报告';
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}

/* --------------------------------------- excel ---------------------------------------- */

function flattenDiagnosticRows(modules) {
  const rows = [];
  for (const module of Array.isArray(modules) ? modules : []) {
    const items = module?.kind === 'diagnostics' ? module.diagnostics ?? [] : [];
    for (const item of items) {
      rows.push({
        发现: item.finding,
        优先级: item.priority,
        证据: item.evidence,
        AI辅助假设: item.hypothesis?.isAiAssisted ? '是（需人工验证）' : '否',
        假设内容: item.hypothesis?.text,
        建议动作: item.suggestedAction,
      });
    }
  }
  return rows;
}

/** Pure workbook definition — [{ name, rows }] testable without the xlsx package. */
export function buildWorkbookSheets(draft, extras = []) {
  const modules = Array.isArray(draft?.modules) ? draft.modules : [];
  const overviewModule = modules.find((module) => module.id === 'overview');
  const sheets = [
    {
      name: '报告概览',
      rows: [
        { 报告标题: overviewModule?.text || '商品经营分析报告', 数据周期: overviewModule?.period || draft?.period || '未配置' },
      ],
    },
  ];
  const diagnostics = flattenDiagnosticRows(modules);
  if (diagnostics.length) sheets.push({ name: '策略诊断', rows: diagnostics });
  for (const module of modules) {
    if (module.kind === 'text' && module.id !== 'overview') sheets.push({ name: module.title, rows: [{ 内容: module.text || '待补充' }] });
  }
  for (const extra of Array.isArray(extras) ? extras : []) {
    if (extra?.name && Array.isArray(extra.rows)) sheets.push({ name: extra.name, rows: extra.rows });
  }
  return sheets;
}

/** Write the workbook through the existing xlsx dependency and download locally. */
export async function exportReportWorkbook(sheets, filename) {
  let XLSX;
  try {
    XLSX = await import('xlsx');
  } catch {
    throw new Error('Excel 导出需要 xlsx 依赖');
  }
  const book = XLSX.utils.book_new();
  for (const sheet of Array.isArray(sheets) ? sheets : []) {
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{}]), String(sheet.name).slice(0, 31));
  }
  const output = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  const name = filename || '商品经营分析报告.xlsx';
  return downloadBlob(new Blob([output], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name.endsWith('.xlsx') ? name : name + '.xlsx');
}
