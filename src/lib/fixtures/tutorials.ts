import type { ExerciseTask, TutorialStep } from './types';

export const quickStartTutorial: TutorialStep[] = [
  { id: 'quick-start-1', title: '先从示例数据开始', body: '点击“示例数据练习”，系统会载入商品、销售、流量等脱敏表格。你可以放心试错，原始数据不会被修改。', target: '[data-tutorial="sample-data"]', actionLabel: '载入示例数据' },
  { id: 'quick-start-2', title: '确认表格和字段', body: '选择一张主表，再查看系统推荐的字段。字段不确定时先看样例值，不要急着合并。', target: '[data-tutorial="field-mapping"]', actionLabel: '查看字段匹配' },
  { id: 'quick-start-3', title: '先检查数据质量', body: '查看空值、重复键和未匹配记录。问题不会阻断整个分析，但要在报告中说明影响范围。', target: '[data-tutorial="quality-check"]', actionLabel: '运行检查' },
  { id: 'quick-start-4', title: '运行分析并看证据', body: '运行默认规则后，点击异常卡片查看指标、周期、阈值和数据来源。结论必须能被复核。', target: '[data-tutorial="diagnosis"]', actionLabel: '查看诊断' },
  { id: 'quick-start-5', title: '整理并导出', body: '确认需要跟进的异常、标题和供应商问题，再选择报告模块导出 Excel、Word、PDF 或可复制的简报。', target: '[data-tutorial="report-export"]', actionLabel: '编辑报告' },
];

export const moduleTutorials: Record<string, TutorialStep[]> = {
  analysis: [
    { id: 'analysis-1', title: '导入多张表', body: '可以一次导入多个文件，或导入一个 Excel 的多个工作表。先选主表，其他表作为补充维度。', target: '[data-tutorial="import"]' },
    { id: 'analysis-2', title: '确认匹配键', body: '常见匹配键是商品 ID、供应商编码和品类编码。系统只做推荐，点击确认前请检查重复和空值。', target: '[data-tutorial="joins"]' },
    { id: 'analysis-3', title: '理解异常规则', body: '例如“高曝光低转化”通常需要同时有曝光、点击和支付字段。缺少字段时，规则会说明为何暂不可用。', target: '[data-tutorial="rules"]' },
  ],
  title: [
    { id: 'title-1', title: '先补齐商品事实', body: '标题建议只能使用已经确认的品类、材质、颜色、版型和功能，不要让 AI 猜测商品事实。', target: '[data-tutorial="title-facts"]' },
    { id: 'title-2', title: '分语言生成', body: '中文、英文等语言分别生成和校验，共享同一份商品事实，但不做逐句翻译。', target: '[data-tutorial="title-language"]' },
    { id: 'title-3', title: '人工审核后导出', body: '只有审核通过且通过长度、禁用词和事实一致性检查的标题，才能进入批量导出。', target: '[data-tutorial="title-review"]' },
  ],
  issues: [
    { id: 'issues-1', title: '记录可执行的问题', body: '问题标题要让别人一眼知道要处理什么，描述中补充商品、影响和需要供应商确认的内容。', target: '[data-tutorial="issue-form"]' },
    { id: 'issues-2', title: '设置状态和截止日期', body: '用状态区分待确认、处理中、等待供应商和已解决，并为需要跟进的问题设置截止日期。', target: '[data-tutorial="issue-status"]' },
  ],
  trends: [
    { id: 'trends-1', title: '记录来源', body: '热点记录至少保留关键词、发现日期、来源平台和链接；截图或备注可以帮助后续复盘。', target: '[data-tutorial="trend-form"]' },
    { id: 'trends-2', title: '把热点变成行动', body: '不要只收藏热点。尝试关联品类、商品或标题任务，并写下下一步验证动作。', target: '[data-tutorial="trend-action"]' },
  ],
};

export const exerciseTasks: ExerciseTask[] = [
  { id: 'exercise-1', level: 1, title: '认识一张商品表', goal: '看懂商品 ID、品类、供应商和站点等维度字段。', estimatedMinutes: 5, requiredTables: ['products'], steps: ['载入示例数据。', '打开“商品基础信息”表，查看表头和前几行。', '筛选站点为 US 的商品，并记录商品数量。'], expectedOutcome: '能说清商品 ID 是后续多表匹配的关键字段。', skills: ['表头识别', '筛选'] },
  { id: 'exercise-2', level: 1, title: '完成一次 VLOOKUP 匹配', goal: '把商品名称、品类和供应商补充到销售明细。', estimatedMinutes: 8, requiredTables: ['sales', 'products', 'categories', 'suppliers'], steps: ['以销售表作为主表。', '按 productId 匹配商品表。', '继续按 categoryId、supplierId 补充名称。', '查看未匹配和重复记录。'], expectedOutcome: '销售记录中可以看到商品名称、品类名称和供应商名称。', skills: ['VLOOKUP/XLOOKUP', '多步匹配', '匹配检查'] },
  { id: 'exercise-3', level: 2, title: '用透视表比较品类', goal: '按品类汇总曝光、点击、支付和销售额。', estimatedMinutes: 10, requiredTables: ['products', 'sales', 'traffic', 'categories'], steps: ['运行多表匹配。', '选择品类作为行，销售额和支付件数作为值。', '增加曝光和点击量，计算点击率与转化率。', '对比上周和本周变化。'], expectedOutcome: '能指出表现最好和需要进一步诊断的品类。', skills: ['数据透视表', '指标计算', '环比比较'] },
  { id: 'exercise-4', level: 2, title: '找到高曝光低转化商品', goal: '使用证据定位需要优先查看的商品。', estimatedMinutes: 10, requiredTables: ['products', 'sales', 'traffic'], steps: ['运行默认异常规则。', '筛选曝光排名前 30% 的商品。', '比较点击率和支付转化率。', '打开一张诊断卡片，查看规则和数据来源。'], expectedOutcome: '至少找到 SKU-1004 或 SKU-1006，并能解释它为何被标记。', skills: ['异常规则', '证据链', '策略诊断'] },
  { id: 'exercise-5', level: 3, title: '完成一份分析简报', goal: '把数据结论、待办和建议整理成可汇报内容。', estimatedMinutes: 15, requiredTables: ['products', 'sales', 'traffic', 'inventory', 'suppliers', 'categories'], steps: ['选择 2 个重要诊断加入报告。', '加入一个趋势图和一个品类对比图。', '补充库存风险和供应商待跟进项。', '编辑结论，导出 Word 或 PDF。'], expectedOutcome: '完成一份包含口径、证据、原因假设和动作的短报告。', skills: ['报告编排', '图表选择', '汇报表达'] },
  { id: 'exercise-6', level: 3, title: '审核多语言商品标题', goal: '分别生成并审核中文、英文标题候选。', estimatedMinutes: 10, requiredTables: ['titleSamples', 'products', 'categories'], steps: ['打开标题样例。', '检查商品事实与关键词。', '分别查看中文和英文候选。', '处理长度、禁用词和事实一致性提示。', '仅导出人工确认的标题。'], expectedOutcome: '至少审核 2 条标题，并能说明修改理由。', skills: ['标题优化', '多语言校验', '人工审核'] },
  { id: 'exercise-7', level: 1, title: '记录热点和供应商问题', goal: '把观察和沟通事项变成可跟踪记录。', estimatedMinutes: 8, requiredTables: ['trendNotes', 'supplierIssues'], steps: ['打开热点样例，检查来源链接和后续行动。', '新增一条与商品关联的热点记录。', '打开供应商问题，修改一个问题的状态和截止日期。', '回到首页查看待办汇总。'], expectedOutcome: '知道热点记录与供应商问题如何进入首页待办。', skills: ['热点记录', '问题台账', '待办跟进'] },
];

export const excelTips = [
  { id: 'tip-vlookup', title: 'VLOOKUP / XLOOKUP', body: '用唯一键把另一张表中的商品名称、品类或供应商补充进主表。先确认键值没有多余空格和重复。', example: '=XLOOKUP(A2, 商品表!A:A, 商品表!B:B, "未匹配")' },
  { id: 'tip-pivot', title: '数据透视表', body: '把维度放到“行”，把指标放到“值”，把日期、站点或品类放到“筛选”，快速比较不同分组。', example: '行：品类；值：销售额、支付件数、曝光量；筛选：站点、日期' },
  { id: 'tip-rate', title: '指标计算', body: '转化率的分母必须和业务口径一致。练习数据中可以用支付件数 ÷ 点击量，并在报告中写清公式。', example: '=IFERROR(支付件数/点击量, 0)' },
];
