export const REVIEW_STATUSES = Object.freeze(['待审核', '已通过', '已拒绝', '待修改']);

const ENGLISH_STOP_WORDS = new Set(['and', 'for', 'the', 'with', 'women', 'woman', 'new']);
const FACT_TRANSLATIONS = new Map([
  ['ribbed knit', '罗纹针织'],
  ['ribbed', '罗纹'],
  ['square neck', '方领'],
  ['slim fit', '修身'],
  ['short sleeve', '短袖'],
  ['high waist', '高腰'],
  ['wide leg', '阔腿'],
  ['cargo pockets', '工装口袋'],
  ['casual', '休闲'],
  ['satin', '缎面'],
  ['bow', '蝴蝶结'],
  ['lightweight', '轻便'],
  ['oversized', '宽松'],
  ['cotton blend', '棉混纺'],
  ['graphic print', '印花'],
  ['unisex', '中性'],
]);

function toList(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return String(value ?? '')
    .split(/[;，,、|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalise(value) {
  return String(value ?? '').toLocaleLowerCase().replace(/[\u3000\s]+/g, ' ').trim();
}

function factPool(product) {
  return [...new Set([
    ...toList(product?.facts),
    ...toList(product?.keywords),
  ])];
}

function englishWords(product) {
  const facts = factPool(product);
  const words = facts
    .flatMap((fact) => normalise(fact).split(/[^a-z0-9]+/i))
    .filter((word) => word && !ENGLISH_STOP_WORDS.has(word));
  return [...new Set(words)];
}

function phrase(facts, fallback) {
  return facts.length ? facts.join(' ') : fallback;
}

function titleNoun(product, language) {
  if (language === 'zh') {
    if (product?.categoryZh) return product.categoryZh;
    if (/top|shirt|tee/i.test(String(product?.productName))) return '上装';
    if (/pants|shorts/i.test(String(product?.productName))) return '裤装';
    if (/dress/i.test(String(product?.productName))) return '连衣裙';
    if (/clip|bag/i.test(String(product?.productName))) return '配饰';
    return '女装';
  }
  if (product?.category) return String(product.category);
  return 'Fashion Item';
}

function englishCandidates(product, count) {
  const sourceFacts = toList(product?.facts).length ? toList(product?.facts) : toList(product?.keywords);
  const words = englishWords(product);
  const noun = titleNoun(product, 'en');
  const factText = phrase(sourceFacts, String(product?.productName ?? 'Everyday Style'));
  const keywordText = toList(product?.keywords).join(', ');
  const templates = [
    `${factText} ${noun}`,
    `${keywordText || factText} ${noun} for Everyday Wear`,
    `${words.slice(0, 4).join(' ')} ${noun} with Comfortable Fit`,
  ];
  return templates.slice(0, count).map((text, index) => ({
    id: `${product?.productId ?? 'title'}-en-${index + 1}`,
    productId: product?.productId,
    language: 'en',
    text: text.replace(/\s+/g, ' ').trim(),
    factsUsed: sourceFacts.slice(0, Math.max(1, Math.min(sourceFacts.length, 4))),
    generatedBy: 'local-template',
    reviewStatus: '待审核',
  }));
}

function chineseCandidates(product, count) {
  const sourceFacts = toList(product?.facts).length ? toList(product?.facts) : toList(product?.keywords);
  const translated = sourceFacts.map((fact) => FACT_TRANSLATIONS.get(normalise(fact)) ?? fact);
  const noun = titleNoun(product, 'zh');
  const factText = phrase(translated, noun);
  const templates = [
    `${factText}${noun}`,
    `${translated.slice(0, 4).join(' ')} ${noun} 日常穿搭`,
    `${noun} ${translated.slice(0, 3).join(' ')} 舒适百搭`,
  ];
  return templates.slice(0, count).map((text, index) => ({
    id: `${product?.productId ?? 'title'}-zh-${index + 1}`,
    productId: product?.productId,
    language: 'zh',
    text: text.replace(/\s+/g, ' ').trim(),
    factsUsed: sourceFacts.slice(0, Math.max(1, Math.min(sourceFacts.length, 4))),
    generatedBy: 'local-template',
    reviewStatus: '待审核',
  }));
}

export function generateTitleCandidates(product, options = {}) {
  const language = options.language ?? 'en';
  const count = Math.max(1, Math.min(3, Number(options.count ?? 3)));
  return language === 'zh' ? chineseCandidates(product, count) : englishCandidates(product, count);
}

export function generateBilingualCandidates(product, options = {}) {
  const count = Math.max(1, Math.min(3, Number(options.count ?? 2)));
  return [
    ...generateTitleCandidates(product, { ...options, language: 'en', count }),
    ...generateTitleCandidates(product, { ...options, language: 'zh', count }),
  ];
}

function tokeniseTitle(text) {
  return normalise(text).match(/[a-z0-9]+|[\u4e00-\u9fff]/gi) ?? [];
}

function duplicateTokens(text) {
  const counts = new Map();
  for (const token of tokeniseTitle(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([token]) => token);
}

export function validateTitle(candidate, product = {}, options = {}) {
  const text = String(candidate?.text ?? '');
  const minLength = Number(options.minLength ?? 5);
  const maxLength = Number(options.maxLength ?? (candidate?.language === 'zh' ? 60 : 120));
  const bannedWords = toList(options.bannedWords);
  const sourceFacts = factPool(product).map(normalise);
  const usedFacts = toList(candidate?.factsUsed);
  const duplicateWords = duplicateTokens(text);
  const bannedMatches = bannedWords.filter((word) => normalise(text).includes(normalise(word)));
  const missingFacts = usedFacts.filter((fact) => !sourceFacts.includes(normalise(fact)));
  const checks = {
    length: {
      valid: text.length >= minLength && text.length <= maxLength,
      actual: text.length,
      min: minLength,
      max: maxLength,
    },
    bannedWords: { valid: bannedMatches.length === 0, matches: bannedMatches },
    factConsistency: { valid: missingFacts.length === 0, missing: missingFacts },
    duplicateWords: { valid: duplicateWords.length === 0, duplicates: duplicateWords },
  };
  const issues = [];
  if (!checks.length.valid) issues.push(`标题长度应在 ${minLength}-${maxLength} 个字符之间`);
  if (!checks.bannedWords.valid) issues.push(`包含禁用词：${bannedMatches.join('、')}`);
  if (!checks.factConsistency.valid) issues.push(`商品事实中不存在：${missingFacts.join('、')}`);
  if (!checks.duplicateWords.valid) issues.push(`重复词：${duplicateWords.join('、')}`);
  return { valid: issues.length === 0, checks, issues };
}

export function updateReviewStatus(items, id, status) {
  if (!REVIEW_STATUSES.includes(status)) throw new Error(`Unsupported review status: ${status}`);
  let found = false;
  const next = items.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return { ...item, reviewStatus: status };
  });
  if (!found) throw new Error(`Title candidate not found: ${id}`);
  return next;
}

/** Batch review after explicit human selection (PRD §9.2：人工审核后才可导出). */
export function bulkUpdateReviewStatus(items, ids, status) {
  if (!REVIEW_STATUSES.includes(status)) throw new Error(`Unsupported review status: ${status}`);
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  if (!wanted.size) return [...items];
  return items.map((item) => (wanted.has(item.id) ? { ...item, reviewStatus: status } : item));
}

/** Token-level diff for review：candidate words not in the original are flagged. */
export function diffTitleWords(originalText, candidateText) {
  const tokenize = (value) => String(value ?? '').trim().split(/\s+/).filter(Boolean);
  const original = new Set(tokenize(originalText).map((word) => word.toLowerCase()));
  return tokenize(candidateText).map((word) => ({ word, isNew: !original.has(word.toLowerCase()) }));
}

export function getApprovedTitles(items) {
  return items.filter((item) => item.reviewStatus === '已通过');
}

export function createTitleItems(rows, options = {}) {
  return rows.flatMap((row) => {
    const product = { ...row, facts: row.facts, keywords: row.keywords };
    return options.language === 'both'
      ? generateBilingualCandidates(product, options)
      : generateTitleCandidates(product, options);
  });
}
