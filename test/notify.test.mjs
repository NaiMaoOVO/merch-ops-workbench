import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyNotification, queryNotifyPermission } from '../src/lib/notify/index.js';

test('有逾期或高优时才提醒，并按优先级拼接', () => {
  const brief = buildDailyNotification({ overdueTasks: 2, dueTodayTasks: 1, highRiskDiagnostics: 3 });
  assert.equal(brief.title, '海外商品运营工作台');
  assert.equal(brief.body, '逾期任务 2 · 今日到期 1 · 高优异常 3');
});

test('无事发生返回 null；仅有待处理问题时兜底提醒', () => {
  assert.equal(buildDailyNotification({}), null);
  assert.equal(buildDailyNotification({ openIssues: 4 }).body, '待处理问题 4');
  assert.equal(buildDailyNotification({ overdueTasks: -5 }), null);
});

test('周一写报提醒：即使没有待办也会触发并置顶', () => {
  const brief = buildDailyNotification({ weeklyNudge: true });
  assert.ok(brief.body.startsWith('上周数据已就绪'));
  const mixed = buildDailyNotification({ weeklyNudge: true, overdueTasks: 2 });
  assert.equal(mixed.body, '上周数据已就绪，该写周报了 · 逾期任务 2');
  assert.equal(buildDailyNotification({ weeklyNudge: false }), null);
});

test('权限探测在无 Notification 环境安全降级', () => {
  assert.equal(queryNotifyPermission(null), 'unsupported');
  assert.equal(queryNotifyPermission({ permission: 'granted', requestPermission: () => {} }), 'granted');
});
