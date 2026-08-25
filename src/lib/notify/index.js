const DAILY_TITLE = '海外商品运营工作台';

/** 组装每日提醒文案；没有值得提醒的内容时返回 null，不打扰用户。 */
export function buildDailyNotification({ overdueTasks = 0, dueTodayTasks = 0, highRiskDiagnostics = 0, openIssues = 0, weeklyNudge = false } = {}) {
  const parts = [];
  const num = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0);
  if (weeklyNudge) parts.push('上周数据已就绪，该写周报了');
  if (num(overdueTasks) > 0) parts.push('逾期任务 ' + num(overdueTasks));
  if (num(dueTodayTasks) > 0) parts.push('今日到期 ' + num(dueTodayTasks));
  if (num(highRiskDiagnostics) > 0) parts.push('高优异常 ' + num(highRiskDiagnostics));
  if (parts.length === 0 && num(openIssues) > 0) parts.push('待处理问题 ' + num(openIssues));
  if (parts.length === 0 && !weeklyNudge) return null;
  return { title: DAILY_TITLE, body: parts.join(' · ') + (parts.length ? '' : '') };
}

/** 权限探测：返回 default/granted/denied/unsupported，不抛错。 */
export function queryNotifyPermission(NotificationImpl = typeof Notification !== 'undefined' ? Notification : null) {
  if (!NotificationImpl || typeof NotificationImpl.requestPermission !== 'function') return 'unsupported';
  return NotificationImpl.permission ?? 'default';
}

/** 请求权限并立即发送一条每日提醒；成功返回 true。 */
export async function enableAndSendDailyNotification(data, NotificationImpl = typeof Notification !== 'undefined' ? Notification : null) {
  if (!NotificationImpl || typeof NotificationImpl.requestPermission !== 'function') return false;
  let permission = NotificationImpl.permission;
  try {
    permission = await NotificationImpl.requestPermission();
  } catch { return false; }
  if (permission !== 'granted') return false;
  const brief = buildDailyNotification(data);
  if (!brief) return false;
  try { new NotificationImpl(brief.title, { body: brief.body }); return true; } catch { return false; }
}
