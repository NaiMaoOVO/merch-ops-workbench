import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAGNOSTIC_STATUSES,
  changeDiagnosticStatus,
  diagnosticToIssuePayload,
  diagnosticToTaskPayload,
  linkRecord,
  summariseByStatus,
} from '../src/lib/associations/index.js';

const diagnostic = { id: 'diagnostic-A-high-impression-low-click', finding: 'A 触发高曝光低点击规则', priority: '高', suggestedAction: '检查标题卖点', projectId: 'proj-1' };

test('linking records keeps originals untouched and allows clearing', () => {
  const linked = linkRecord({ id: 'x' }, 'proj-9');
  assert.equal(linked.projectId, 'proj-9');
  assert.equal(linked.id, 'x');
  assert.equal(linkRecord({ id: 'y' }, '').projectId, undefined);
  assert.throws(() => linkRecord({}, 'p'), /record\.id/);
});

test('diagnostic lifecycle only accepts known statuses immutably', () => {
  const moved = changeDiagnosticStatus(diagnostic, '已确认', { now: '2026-08-25T00:00:00.000Z', note: '数据核实' });
  assert.equal(moved.status, '已确认');
  assert.equal(moved.statusNote, '数据核实');
  assert.equal(diagnostic.status, undefined);
  assert.throws(() => changeDiagnosticStatus(diagnostic, '随便'), /未知的诊断状态/);
  assert.deepEqual(DIAGNOSTIC_STATUSES, ['待确认', '已确认', '已转任务', '已解决', '已复查']);
});

test('diagnostics convert into task payloads carrying project and source ids', () => {
  const payload = diagnosticToTaskPayload(diagnostic, { dueDate: '2026-09-01' });
  assert.equal(payload.sourceDiagnosticId, diagnostic.id);
  assert.equal(payload.projectId, 'proj-1');
  assert.equal(payload.priority, '高');
  assert.match(payload.title, /^处理：/);
  assert.equal(payload.done, false);
  assert.throws(() => diagnosticToTaskPayload({}), /diagnostic\.id/);
});

test('supplier issue payloads keep the ledger fields separate', () => {
  const issue = diagnosticToIssuePayload(diagnostic, { supplierId: 'SUP-01', productId: 'SKU-1' });
  assert.equal(issue.supplierId, 'SUP-01');
  assert.equal(issue.productId, 'SKU-1');
  assert.equal(issue.status, '待处理');
});

test('status summaries filter by project for honest dashboards', () => {
  const records = [
    { status: '待处理', projectId: 'p1' },
    { status: '待处理', projectId: 'p1' },
    { status: '已解决', projectId: 'p2' },
  ];
  assert.deepEqual(summariseByStatus(records, 'p1'), { total: 2, byStatus: { 待处理: 2 } });
  assert.equal(summariseByStatus(records).total, 3);
});
