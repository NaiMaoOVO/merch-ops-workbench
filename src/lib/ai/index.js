/**
 * Optional AI assistance layer (PRD §16).
 * Speaks the OpenAI-compatible chat-completions dialect only. Every call is
 * explicit, previewable and fully optional — local rule analysis (lib/analysis)
 * never imports this module, so missing or broken AI keeps the workbench usable.
 */

const DEFAULT_TIMEOUT_MS = 20000;

/** Normalise a base URL into an absolute /chat/completions endpoint. */
export function buildChatEndpoint(baseUrl) {
    const trimmed = String(baseUrl ?? '').trim().replace(/\/+$/, '');
    if (!trimmed) throw new Error('接口地址不能为空');
    if (!/^https?:\/\//i.test(trimmed)) throw new Error('接口地址必须是有效的 http(s) 地址');
    if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
    return trimmed + '/chat/completions';
}

/** Pull the assistant reply out of an OpenAI-style response body. */
export function extractAssistantText(payload) {
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (payload?.error?.message) throw new Error('接口返回错误：' + payload.error.message);
    throw new Error('接口响应格式无法识别（缺少 choices[0].message.content）');
}

async function requestChatCompletion(config, body, options = {}) {
    const fetchImpl = options.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') throw new Error('当前环境不支持网络请求');
    const endpoint = buildChatEndpoint(config.baseUrl);
    const controller = typeof AbortController !== 'undefined' && !options.signal ? new AbortController() : null;
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
    const timer = controller && timeoutMs > 0 ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
        response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
            body: JSON.stringify(body),
            signal: options.signal ?? controller?.signal,
        });
    } catch (error) {
        throw new Error(error?.name === 'AbortError' ? '请求超时（' + timeoutMs + 'ms），可稍后重试' : '网络请求失败：' + (error?.message ?? error));
    } finally {
        if (timer) clearTimeout(timer);
    }
    const text = await response.text().catch(() => '');
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { /* 非 JSON 响应，交给下方错误分支 */ }
    if (!response.ok) {
        const detail = payload?.error?.message ?? text.slice(0, 180);
        throw new Error('接口返回 ' + response.status + (detail ? '：' + detail : ''));
    }
    return payload;
}

/** One chat-completion round trip; resolves with the assistant text. */
export async function callChatCompletion(config, options = {}) {
    const messages = options.messages;
    if (!Array.isArray(messages) || !messages.length) throw new Error('messages 不能为空');
    const body = { model: config.model, messages, temperature: options.temperature ?? 0.4 };
    if (Number.isFinite(options.maxTokens)) body.max_tokens = options.maxTokens;
    const payload = await requestChatCompletion(config, body, options);
    return extractAssistantText(payload);
}

/** PRD §16.1 测试连接：tiny request that proves endpoint + key + model work. */
export async function testConnection(config, options = {}) {
    let endpoint;
    try { endpoint = buildChatEndpoint(config.baseUrl); } catch (error) {
        return { ok: false, endpoint: '', error: error.message };
    }
    try {
        const reply = await callChatCompletion(config, { messages: [{ role: 'user', content: '连接测试，请只回复 OK' }], maxTokens: 8, temperature: 0, fetchImpl: options.fetchImpl, timeoutMs: options.timeoutMs ?? 10000 });
        return { ok: true, endpoint, reply: reply.slice(0, 40) };
    } catch (error) {
        return { ok: false, endpoint, error: error.message };
    }
}

/* ------------------------------- desensitisation -------------------------------- */

const normaliseHeader = (header) => String(header ?? '').replace(/\s+/g, '');

/** Stable pseudonyms let the model group rows without seeing raw identifiers. */
export function pseudonymizeValues(values, prefix) {
    const tag = prefix || '匿名';
    const seen = new Map();
    return values.map((value) => {
        const key = String(value ?? '');
        if (!seen.has(key)) seen.set(key, tag + '-' + (seen.size + 1));
        return seen.get(key);
    });
}

/**
 * Remove masked columns entirely (settings「发送前脱敏字段」) and/or replace
 * identifier columns with stable aliases. Header matching ignores spaces so
 * 「商品 ID」 matches a column literally named 商品ID.
 */
export function maskRows(rows, options = {}) {
    const input = Array.isArray(rows) ? rows : [];
    if (!input.length) return [];
    const maskedFields = (options.maskedFields ?? []).map(normaliseHeader);
    const pseudoFields = options.pseudonymizedFields ?? [];
    const headers = [...new Set(input.flatMap((row) => Object.keys(row)))];
    const dropped = headers.filter((header) => maskedFields.includes(normaliseHeader(header)));
    const aliasCache = new Map();
    for (const field of pseudoFields) {
        const header = headers.find((candidate) => normaliseHeader(candidate) === normaliseHeader(field.column));
        if (header && !dropped.includes(header)) aliasCache.set(header, pseudonymizeValues(input.map((row) => row[header]), field.prefix));
    }
    return input.map((row, index) => Object.fromEntries(headers
        .filter((header) => !dropped.includes(header))
        .map((header) => [header, aliasCache.has(header) ? aliasCache.get(header)[index] : row[header]])));
}

/* --------------------------- anomaly hypothesis builder -------------------------- */

export const HYPOTHESIS_SYSTEM_PROMPT = '你是跨境电商商品运营的数据分析助手。基于用户给出的脱敏汇总指标，提出可能原因假设和下一步验证动作。要求：只输出假设而非结论；每条以「辅助假设」开头；用中文；总长不超过 150 字。';

/**
 * Build the anomaly-reasoning request AND its send preview (PRD §16.3): the UI
 * shows target endpoint + exact fields before the user releases the request.
 */
export function buildAnomalyHypothesisRequest(anomalies, options = {}) {
    const source = Array.isArray(anomalies) ? anomalies : [];
    const rows = source.map((item) => ({
        商品ID: item.productId,
        曝光量: item.impressions,
        点击率: ((Number(item.clickRate) || 0) * 100).toFixed(2) + '%',
        支付转化率: ((Number(item.conversionRate) || 0) * 100).toFixed(2) + '%',
        规则: item.rule === 'high-impression-low-click' ? '高曝光低点击' : String(item.rule ?? ''),
    }));
    const hideProductColumn = Boolean(options.hideProductId);
    const maskedRows = maskRows(rows, {
        maskedFields: hideProductColumn ? ['商品ID'] : [],
        pseudonymizedFields: hideProductColumn ? [] : [{ column: '商品ID', prefix: 'SKU' }],
    });
    const messages = [
        { role: 'system', content: HYPOTHESIS_SYSTEM_PROMPT },
        { role: 'user', content: '异常商品汇总（已脱敏）：' + JSON.stringify(maskedRows) + '。请给出可能原因与验证建议。' },
    ];
    return {
        messages,
        maskedRows,
        preview: { fields: Object.keys(maskedRows[0] ?? {}), rowCount: maskedRows.length, productColumnHidden: hideProductColumn },
    };
}

export const WEEKLY_DIGEST_SYSTEM_PROMPT = '你是跨境电商运营周报助手。基于脱敏的汇总数据输出 3 条可执行摘要，每条不超过 45 字；只描述数据与建议，不编造原因；每条以「待审核摘要：」开头。';

/** 构建周报摘要请求：仅包含汇总指标、周期对比和用户事件标签。 */
export function buildWeeklyDigestRequest({ totals = {}, comparison = [], annotations = [], period = '本周期' } = {}) {
    const safeTotals = Object.fromEntries(Object.entries(totals ?? {}).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]));
    const safeComparison = (Array.isArray(comparison) ? comparison : []).filter((item) => item && typeof item.metric === 'string').slice(0, 20).map((item) => ({
        metric: item.metric,
        previous: Number(item.previous) || 0,
        current: Number(item.current) || 0,
        change: String(item.changeLabel ?? ''),
    }));
    const safeAnnotations = (Array.isArray(annotations) ? annotations : []).slice(0, 20).map((item) => ({ date: String(item.date ?? ''), label: String(item.label ?? '').slice(0, 40) })).filter((item) => item.date && item.label);
    const payload = { period: String(period), totals: safeTotals, comparison: safeComparison, events: safeAnnotations };
    const messages = [
        { role: 'system', content: WEEKLY_DIGEST_SYSTEM_PROMPT },
        { role: 'user', content: '周报脱敏汇总：' + JSON.stringify(payload) + '。请输出 3 条执行摘要。' },
    ];
    return { messages, maskedSummary: payload, preview: { fields: ['period', 'totals', 'comparison', 'events'], rowCount: safeComparison.length, sensitiveFieldsExcluded: true } };
}

/** 解析摘要为可编辑文本，所有结果都必须人工审核。 */
export function parseWeeklyDigest(text) {
    return String(text ?? '').split(/\r?\n/).map((line) => line.replace(/^[-*\d.、）)]+\s*/, '').trim()).filter(Boolean).slice(0, 3).map((line) => ('待审核摘要：' + line.replace(/^待审核摘要：/, '')).slice(0, 80)).join('\n');
}

/* ------------------------------ title candidates -------------------------------- */

/** Shared local-settings reader so every feature sees the same AI config. */
export function readSavedSettings(storage) {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return {};
    try { return JSON.parse(store.getItem('merch-workbench-settings') || '{}'); } catch { return {}; }
}

const TITLE_SYSTEM_PROMPT = '你是跨境电商商品标题优化助手。基于给定的商品事实生成候选标题。要求：严格使用提供的卖点与关键词，不编造属性；规避禁用词；每个商品最多 3 条；只输出 JSON 数组，格式 [{"id":"商品别名ID","language":"en 或 zh","text":"标题"}]。这些是辅助建议，需人工审核。';

const toFactList = (value) => Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean)
    : String(value ?? '').split(/[;，,、|\n]/).map((item) => item.trim()).filter(Boolean);

/** Build the title-candidate request plus its send preview (PRD §9.2 + §16.3). */
export function buildTitleCandidatesRequest(products, options = {}) {
    const source = Array.isArray(products) ? products : [];
    const languageLabel = options.language === 'zh' ? '中文' : options.language === 'en' ? '英文' : '中英双语';
    const hideProductColumn = Boolean(options.hideProductId);
    const rows = source.map((product) => ({
        商品ID: product.productId,
        品类: product.categoryZh ?? product.category ?? '',
        卖点与关键词: [...toFactList(product.facts), ...toFactList(product.keywords)].join('、'),
        原标题: product.originalTitle ?? '',
    }));
    const maskedRows = maskRows(rows, {
        maskedFields: hideProductColumn ? ['商品ID'] : [],
        pseudonymizedFields: hideProductColumn ? [] : [{ column: '商品ID', prefix: 'SKU' }],
    });
    const bannedWords = Array.isArray(options.bannedWords) ? options.bannedWords.filter(Boolean) : [];
    const userPrompt = '目标语言：' + languageLabel
        + (options.maxLength ? '；字符上限：' + options.maxLength : '')
        + (bannedWords.length ? '；禁用词：' + bannedWords.join('、') : '')
        + '。商品列表（已脱敏）：' + JSON.stringify(maskedRows);
    return {
        messages: [
            { role: 'system', content: TITLE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
        ],
        maskedRows,
        preview: {
            fields: Object.keys(maskedRows[0] ?? {}),
            rowCount: maskedRows.length,
            productColumnHidden: hideProductColumn,
            // 别名 → 真实 ID 的还原表只在本地使用，不会发送
            aliasMap: hideProductColumn ? null : Object.fromEntries(pseudonymizeValues(rows.map((row) => row.商品ID), 'SKU').map((alias, index) => [alias, rows[index].商品ID])),
        },
    };
}

/**
 * Parse the model reply into candidate objects shaped like the local generator's,
 * flagged generatedBy:'ai-assisted' and 待审核 — never auto-approved.
 */
export function parseTitleCandidates(text, options = {}) {
    const raw = String(text ?? '').trim();
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
    let jsonText = fenced ? fenced[1] : '';
    if (!jsonText) {
        const match = /\[[\s\S]*\]/.exec(raw);
        jsonText = match ? match[0] : raw;
    }
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch { throw new Error('AI 返回内容不是有效的 JSON 数组，已丢弃，可重试'); }
    if (!Array.isArray(parsed)) throw new Error('AI 返回内容不是 JSON 数组');
    const aliasMap = options.aliasMap ?? null;
    const maxPerProduct = Math.max(1, Math.min(3, Number(options.maxPerProduct ?? 3)));
    const counters = new Map();
    const items = [];
    for (const entry of parsed) {
        if (!entry || typeof entry.text !== 'string' || !entry.text.trim()) continue;
        const alias = String(entry.id ?? '');
        const productId = (aliasMap && aliasMap[alias]) || alias || null;
        const language = entry.language === 'zh' ? 'zh' : 'en';
        const key = (productId ?? 'unknown') + ':' + language;
        const index = (counters.get(key) ?? 0) + 1;
        if (index > maxPerProduct) continue;
        counters.set(key, index);
        items.push({
            id: (productId ?? 'ai') + '-' + language + '-ai-' + index,
            productId,
            language,
            text: entry.text.trim(),
            factsUsed: [],
            generatedBy: 'ai-assisted',
            reviewStatus: '待审核',
        });
    }
    if (!items.length) throw new Error('AI 未返回可用标题');
    return items;
}
