import type { FixtureBundle, FixtureColumn, FixtureTableFixture } from './types';

const columns = (...items: FixtureColumn[]): FixtureColumn[] => items;

const products: FixtureTableFixture = {
  name: 'products',
  label: '商品基础信息',
  description: '商品、品类、供应商和站点的基础维度，用于与经营数据匹配。',
  primaryKey: 'productId',
  columns: columns(
    { key: 'productId', label: '商品ID', type: 'text', role: 'required', aliases: ['商品 ID', '货号', 'SKU'] },
    { key: 'productName', label: '商品名称', type: 'text', role: 'recommended', aliases: ['商品名'] },
    { key: 'categoryId', label: '品类编码', type: 'text', role: 'recommended', aliases: ['品类 ID'] },
    { key: 'supplierId', label: '供应商编码', type: 'text', role: 'recommended', aliases: ['供应商 ID'] },
    { key: 'site', label: '站点', type: 'enum', role: 'recommended', aliases: ['市场', '国家'] },
    { key: 'launchDate', label: '上架日期', type: 'date', role: 'optional', aliases: ['上架时间'] },
    { key: 'price', label: '售价', type: 'number', role: 'optional', aliases: ['价格'] },
  ),
  rows: [
    { productId: 'SKU-1001', productName: 'Ribbed Square Neck Top', categoryId: 'CAT-TOP', supplierId: 'SUP-01', site: 'US', launchDate: '2026-07-18', price: 12.99 },
    { productId: 'SKU-1002', productName: 'Wide Leg Cargo Pants', categoryId: 'CAT-BTM', supplierId: 'SUP-02', site: 'US', launchDate: '2026-07-25', price: 24.99 },
    { productId: 'SKU-1003', productName: 'Satin Bow Hair Clip', categoryId: 'CAT-ACC', supplierId: 'SUP-03', site: 'UK', launchDate: '2026-08-02', price: 4.99 },
    { productId: 'SKU-1004', productName: 'Oversized Graphic Tee', categoryId: 'CAT-TOP', supplierId: 'SUP-01', site: 'UK', launchDate: '2026-06-30', price: 16.99 },
    { productId: 'SKU-1005', productName: 'Floral Ruched Dress', categoryId: 'CAT-DRS', supplierId: 'SUP-04', site: 'US', launchDate: '2026-08-05', price: 29.99 },
    { productId: 'SKU-1006', productName: 'Lightweight Knit Cardigan', categoryId: 'CAT-TOP', supplierId: 'SUP-02', site: 'US', launchDate: '2026-07-11', price: 22.99 },
    { productId: 'SKU-1007', productName: 'Minimalist Shoulder Bag', categoryId: 'CAT-BAG', supplierId: 'SUP-05', site: 'CA', launchDate: '2026-08-08', price: 19.99 },
    { productId: 'SKU-1008', productName: 'Linen Blend Shorts', categoryId: 'CAT-BTM', supplierId: 'SUP-04', site: 'US', launchDate: '2026-07-29', price: 18.99 },
  ],
};

const sales: FixtureTableFixture = {
  name: 'sales',
  label: '销售数据',
  description: '按商品和日期记录的支付、销售额和加购数据。',
  columns: columns(
    { key: 'date', label: '日期', type: 'date', role: 'required', aliases: ['统计日期'] },
    { key: 'productId', label: '商品ID', type: 'text', role: 'required', aliases: ['商品 ID', '货号', 'SKU'] },
    { key: 'orders', label: '支付件数', type: 'number', role: 'recommended', aliases: ['订单数', '支付数量'] },
    { key: 'revenue', label: '销售额', type: 'number', role: 'recommended', aliases: ['GMV', '成交金额'] },
    { key: 'addToCart', label: '加购件数', type: 'number', role: 'optional', aliases: ['加购'] },
  ),
  rows: [
    { date: '2026-08-17', productId: 'SKU-1001', orders: 42, revenue: 545.58, addToCart: 118 },
    { date: '2026-08-17', productId: 'SKU-1002', orders: 18, revenue: 449.82, addToCart: 74 },
    { date: '2026-08-17', productId: 'SKU-1003', orders: 31, revenue: 154.69, addToCart: 92 },
    { date: '2026-08-17', productId: 'SKU-1004', orders: 8, revenue: 135.92, addToCart: 41 },
    { date: '2026-08-17', productId: 'SKU-1005', orders: 25, revenue: 749.75, addToCart: 63 },
    { date: '2026-08-17', productId: 'SKU-1006', orders: 6, revenue: 137.94, addToCart: 38 },
    { date: '2026-08-17', productId: 'SKU-1007', orders: 14, revenue: 279.86, addToCart: 46 },
    { date: '2026-08-17', productId: 'SKU-1008', orders: 4, revenue: 75.96, addToCart: 27 },
    { date: '2026-08-24', productId: 'SKU-1001', orders: 48, revenue: 623.52, addToCart: 129 },
    { date: '2026-08-24', productId: 'SKU-1002', orders: 15, revenue: 374.85, addToCart: 70 },
    { date: '2026-08-24', productId: 'SKU-1003', orders: 36, revenue: 179.64, addToCart: 104 },
    { date: '2026-08-24', productId: 'SKU-1004', orders: 7, revenue: 118.93, addToCart: 39 },
    { date: '2026-08-24', productId: 'SKU-1005', orders: 19, revenue: 569.81, addToCart: 58 },
    { date: '2026-08-24', productId: 'SKU-1006', orders: 5, revenue: 114.95, addToCart: 31 },
    { date: '2026-08-24', productId: 'SKU-1007', orders: 17, revenue: 339.83, addToCart: 54 },
    { date: '2026-08-24', productId: 'SKU-1008', orders: 3, revenue: 56.97, addToCart: 24 },
  ],
};

const traffic: FixtureTableFixture = {
  name: 'traffic',
  label: '流量数据',
  description: '按商品和日期记录曝光、访问和点击，用于漏斗与异常诊断。',
  columns: columns(
    { key: 'date', label: '日期', type: 'date', role: 'required', aliases: ['统计日期'] },
    { key: 'productId', label: '商品ID', type: 'text', role: 'required', aliases: ['商品 ID', '货号', 'SKU'] },
    { key: 'impressions', label: '曝光量', type: 'number', role: 'recommended', aliases: ['曝光'] },
    { key: 'visits', label: '访问量', type: 'number', role: 'recommended', aliases: ['访客数', '点击量'] },
    { key: 'clicks', label: '点击量', type: 'number', role: 'optional', aliases: ['点击'] },
  ),
  rows: [
    { date: '2026-08-17', productId: 'SKU-1001', impressions: 24500, visits: 1680, clicks: 1130 },
    { date: '2026-08-17', productId: 'SKU-1002', impressions: 19800, visits: 960, clicks: 580 },
    { date: '2026-08-17', productId: 'SKU-1003', impressions: 8200, visits: 690, clicks: 520 },
    { date: '2026-08-17', productId: 'SKU-1004', impressions: 31000, visits: 740, clicks: 380 },
    { date: '2026-08-17', productId: 'SKU-1005', impressions: 17400, visits: 1420, clicks: 980 },
    { date: '2026-08-17', productId: 'SKU-1006', impressions: 22400, visits: 620, clicks: 315 },
    { date: '2026-08-17', productId: 'SKU-1007', impressions: 12900, visits: 920, clicks: 610 },
    { date: '2026-08-17', productId: 'SKU-1008', impressions: 15600, visits: 450, clicks: 250 },
    { date: '2026-08-24', productId: 'SKU-1001', impressions: 26800, visits: 1920, clicks: 1290 },
    { date: '2026-08-24', productId: 'SKU-1002', impressions: 21000, visits: 1020, clicks: 600 },
    { date: '2026-08-24', productId: 'SKU-1003', impressions: 9100, visits: 810, clicks: 620 },
    { date: '2026-08-24', productId: 'SKU-1004', impressions: 34800, visits: 720, clicks: 350 },
    { date: '2026-08-24', productId: 'SKU-1005', impressions: 19300, visits: 1320, clicks: 890 },
    { date: '2026-08-24', productId: 'SKU-1006', impressions: 23900, visits: 610, clicks: 290 },
    { date: '2026-08-24', productId: 'SKU-1007', impressions: 14100, visits: 1010, clicks: 690 },
    { date: '2026-08-24', productId: 'SKU-1008', impressions: 16200, visits: 390, clicks: 210 },
  ],
};

const inventory: FixtureTableFixture = {
  name: 'inventory',
  label: '库存数据',
  description: '商品可售库存与近期开售状态，用于识别缺货和积压风险。',
  columns: columns(
    { key: 'snapshotDate', label: '库存日期', type: 'date', role: 'required', aliases: ['日期'] },
    { key: 'productId', label: '商品ID', type: 'text', role: 'required', aliases: ['商品 ID', '货号', 'SKU'] },
    { key: 'availableStock', label: '可售库存', type: 'number', role: 'recommended', aliases: ['库存量'] },
    { key: 'daysOfCover', label: '库存可售天数', type: 'number', role: 'optional', aliases: ['库存周转天数'] },
    { key: 'status', label: '库存状态', type: 'enum', role: 'optional', aliases: ['库存风险'] },
  ),
  rows: [
    { snapshotDate: '2026-08-24', productId: 'SKU-1001', availableStock: 260, daysOfCover: 38, status: '正常' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1002', availableStock: 42, daysOfCover: 15, status: '偏低' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1003', availableStock: 680, daysOfCover: 120, status: '积压' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1004', availableStock: 18, daysOfCover: 16, status: '偏低' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1005', availableStock: 210, daysOfCover: 55, status: '正常' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1006', availableStock: 320, daysOfCover: 64, status: '正常' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1007', availableStock: 16, daysOfCover: 12, status: '偏低' },
    { snapshotDate: '2026-08-24', productId: 'SKU-1008', availableStock: 190, daysOfCover: 110, status: '积压' },
  ],
};

const suppliers: FixtureTableFixture = {
  name: 'suppliers',
  label: '供应商信息',
  description: '用于补充供应商名称、联系人和服务等级的维度表。',
  primaryKey: 'supplierId',
  columns: columns(
    { key: 'supplierId', label: '供应商编码', type: 'text', role: 'required', aliases: ['供应商 ID'] },
    { key: 'supplierName', label: '供应商名称', type: 'text', role: 'recommended', aliases: ['供应商'] },
    { key: 'contact', label: '联系人', type: 'text', role: 'optional' },
    { key: 'serviceLevel', label: '服务等级', type: 'enum', role: 'optional' },
  ),
  rows: [
    { supplierId: 'SUP-01', supplierName: '广州棉语服饰', contact: '林女士', serviceLevel: 'A' },
    { supplierId: 'SUP-02', supplierName: '东莞简作供应链', contact: '陈先生', serviceLevel: 'B' },
    { supplierId: 'SUP-03', supplierName: '义乌小饰界', contact: '周女士', serviceLevel: 'A' },
    { supplierId: 'SUP-04', supplierName: '杭州轻衣工坊', contact: '王先生', serviceLevel: 'B' },
    { supplierId: 'SUP-05', supplierName: '深圳包袋社', contact: '赵女士', serviceLevel: 'A' },
  ],
};

const categories: FixtureTableFixture = {
  name: 'categories',
  label: '品类映射',
  description: '将品类编码映射为中文、英文名称，便于分组分析和多语言标题。',
  primaryKey: 'categoryId',
  columns: columns(
    { key: 'categoryId', label: '品类编码', type: 'text', role: 'required', aliases: ['品类 ID'] },
    { key: 'categoryNameZh', label: '中文品类', type: 'text', role: 'recommended' },
    { key: 'categoryNameEn', label: '英文品类', type: 'text', role: 'recommended' },
  ),
  rows: [
    { categoryId: 'CAT-TOP', categoryNameZh: '上装', categoryNameEn: 'Tops' },
    { categoryId: 'CAT-BTM', categoryNameZh: '下装', categoryNameEn: 'Bottoms' },
    { categoryId: 'CAT-ACC', categoryNameZh: '配饰', categoryNameEn: 'Accessories' },
    { categoryId: 'CAT-DRS', categoryNameZh: '连衣裙', categoryNameEn: 'Dresses' },
    { categoryId: 'CAT-BAG', categoryNameZh: '包袋', categoryNameEn: 'Bags' },
  ],
};

const titleSamples: FixtureTableFixture = {
  name: 'titleSamples',
  label: '标题优化样例',
  description: '包含待优化标题、卖点事实和审核结果的练习数据。',
  columns: columns(
    { key: 'productId', label: '商品ID', type: 'text', role: 'required', aliases: ['商品 ID', 'SKU'] },
    { key: 'language', label: '语言', type: 'enum', role: 'required' },
    { key: 'originalTitle', label: '原标题', type: 'text', role: 'required' },
    { key: 'facts', label: '商品事实', type: 'text', role: 'recommended' },
    { key: 'keywords', label: '目标关键词', type: 'text', role: 'recommended' },
    { key: 'reviewStatus', label: '审核状态', type: 'enum', role: 'optional' },
  ),
  rows: [
    { productId: 'SKU-1001', language: 'en', originalTitle: 'Women Top', facts: 'ribbed knit; square neck; slim fit; short sleeve', keywords: 'ribbed top, square neck, slim fit', reviewStatus: '待审核' },
    { productId: 'SKU-1002', language: 'en', originalTitle: 'Pants women new', facts: 'high waist; wide leg; cargo pockets; casual', keywords: 'wide leg pants, cargo pants, high waist', reviewStatus: '待审核' },
    { productId: 'SKU-1003', language: 'zh', originalTitle: '蝴蝶结发夹', facts: '缎面; 蝴蝶结; 轻便; 日常配饰', keywords: '缎面发夹, 蝴蝶结发饰, 女生配饰', reviewStatus: '待审核' },
    { productId: 'SKU-1004', language: 'en', originalTitle: 'Graphic T Shirt', facts: 'oversized; cotton blend; graphic print; unisex', keywords: 'oversized graphic tee, cotton blend t-shirt', reviewStatus: '待审核' },
  ],
};

const trendNotes: FixtureTableFixture = {
  name: 'trendNotes',
  label: '热点观察样例',
  description: '用于练习记录热点、来源、相关品类和后续行动。',
  columns: columns(
    { key: 'noteId', label: '记录ID', type: 'text', role: 'required' },
    { key: 'keyword', label: '关键词', type: 'text', role: 'required' },
    { key: 'categoryId', label: '关联品类', type: 'text', role: 'recommended' },
    { key: 'sourcePlatform', label: '来源平台', type: 'text', role: 'recommended' },
    { key: 'sourceUrl', label: '来源链接', type: 'text', role: 'optional' },
    { key: 'discoveredDate', label: '发现日期', type: 'date', role: 'required' },
    { key: 'heatLevel', label: '热度判断', type: 'enum', role: 'recommended' },
    { key: 'observation', label: '观察结论', type: 'text', role: 'optional' },
  ),
  rows: [
    { noteId: 'TREND-001', keyword: 'soft utility', categoryId: 'CAT-TOP', sourcePlatform: '示例观察', sourceUrl: 'https://example.com/trends/soft-utility', discoveredDate: '2026-08-22', heatLevel: '中', observation: '可关注柔软面料与功能口袋的结合，先做标题关键词记录。' },
    { noteId: 'TREND-002', keyword: 'satin bow', categoryId: 'CAT-ACC', sourcePlatform: '示例观察', sourceUrl: 'https://example.com/trends/satin-bow', discoveredDate: '2026-08-23', heatLevel: '高', observation: '与发饰商品事实高度相关，可关联 SKU-1003 做标题测试。' },
  ],
};

const supplierIssues: FixtureTableFixture = {
  name: 'supplierIssues',
  label: '供应商问题样例',
  description: '用于练习问题记录、状态跟进、截止日期和解决方案。',
  columns: columns(
    { key: 'issueId', label: '问题ID', type: 'text', role: 'required' },
    { key: 'supplierId', label: '供应商编码', type: 'text', role: 'required' },
    { key: 'productId', label: '关联商品', type: 'text', role: 'recommended' },
    { key: 'title', label: '问题标题', type: 'text', role: 'required' },
    { key: 'type', label: '问题类型', type: 'enum', role: 'recommended' },
    { key: 'priority', label: '优先级', type: 'enum', role: 'recommended' },
    { key: 'status', label: '当前状态', type: 'enum', role: 'required' },
    { key: 'dueDate', label: '截止日期', type: 'date', role: 'optional' },
    { key: 'description', label: '问题描述', type: 'text', role: 'optional' },
  ),
  rows: [
    { issueId: 'ISSUE-001', supplierId: 'SUP-02', productId: 'SKU-1002', title: '大码库存补充时间未确认', type: '库存', priority: '高', status: '等待供应商', dueDate: '2026-08-27', description: '需要确认 2XL 及以上尺码的补货数量与预计到仓日期。' },
    { issueId: 'ISSUE-002', supplierId: 'SUP-04', productId: 'SKU-1005', title: '连衣裙图片缺少背面图', type: '素材', priority: '中', status: '处理中', dueDate: '2026-08-29', description: '详情页需要补充背面和面料细节图。' },
    { issueId: 'ISSUE-003', supplierId: 'SUP-03', productId: 'SKU-1003', title: '缎面材质描述待确认', type: '信息', priority: '低', status: '待确认', dueDate: '2026-09-01', description: '请确认材质描述是否可以使用 satin，避免标题事实不一致。' },
  ],
};

export const sampleFixtureBundle: FixtureBundle = {
  id: 'sample-week-2026-08-24',
  name: '新人练习数据｜商品经营分析',
  description: '一组可完整走通导入、匹配、分析、诊断、标题审核和问题跟进的脱敏模拟数据。',
  period: { start: '2026-08-17', end: '2026-08-24', label: '2026-08-17 至 2026-08-24' },
  tables: { products, sales, traffic, inventory, suppliers, categories, titleSamples, trendNotes, supplierIssues },
};

export const sampleTables = Object.values(sampleFixtureBundle.tables);
