import test from 'node:test';
import assert from 'node:assert/strict';

import {
  archiveProject,
  buildBackupPayload,
  cloneProject,
  listProjects,
  restoreBackup,
  serialiseBackup,
} from '../src/features/history/index.js';

const projects = [
  { id: 'older', name: '第 32 周', updatedAt: '2026-08-10', archived: false },
  { id: 'newer', name: '第 34 周', updatedAt: '2026-08-24', archived: false },
  { id: 'archived', name: '第 31 周', updatedAt: '2026-08-03', archived: true },
];

test('lists active projects newest first and can include archived projects', () => {
  assert.deepEqual(listProjects(projects).map((item) => item.id), ['newer', 'older']);
  assert.deepEqual(listProjects(projects, { includeArchived: true }).map((item) => item.id), ['newer', 'older', 'archived']);
});

test('clones a project with a new id and resets transient status', () => {
  const copy = cloneProject(projects[1], { id: 'copy-34', now: '2026-08-25T10:00:00.000Z' });
  assert.equal(copy.id, 'copy-34');
  assert.equal(copy.name, '第 34 周（副本）');
  assert.equal(copy.archived, false);
  assert.equal(copy.updatedAt, '2026-08-25T10:00:00.000Z');
  assert.notEqual(copy, projects[1]);
});

test('archives a project immutably', () => {
  const archived = archiveProject(projects[1], true, '2026-08-25T11:00:00.000Z');
  assert.equal(archived.archived, true);
  assert.equal(archived.archivedAt, '2026-08-25T11:00:00.000Z');
  assert.equal(projects[1].archived, false);
});

test('backup payload excludes API keys recursively', () => {
  const payload = buildBackupPayload({ projects: [{ id: 'p1', apiKey: 'top-secret', settings: { apiKey: 'nested' }, name: 'A' }], templates: [{ id: 't1', value: 1 }] });
  assert.equal(payload.version, 1);
  assert.equal(payload.projects[0].apiKey, undefined);
  assert.equal(payload.projects[0].settings.apiKey, undefined);
  assert.deepEqual(payload.templates, [{ id: 't1', value: 1 }]);
  assert.equal(serialiseBackup({ projects: [] }).includes('apiKey'), false);
});

test('restores backup with skip, overwrite, and copy conflict strategies', () => {
  const incoming = { version: 1, exportedAt: '2026-08-25T00:00:00.000Z', projects: [{ id: 'p1', name: 'Imported', updatedAt: '2026-08-25' }], templates: [] };
  const existing = [{ id: 'p1', name: 'Existing', updatedAt: '2026-08-20' }];
  assert.deepEqual(restoreBackup(incoming, existing, { strategy: 'skip' }).projects.map((item) => item.name), ['Existing']);
  assert.deepEqual(restoreBackup(incoming, existing, { strategy: 'overwrite' }).projects.map((item) => item.name), ['Imported']);
  const copied = restoreBackup(incoming, existing, { strategy: 'copy', idFactory: () => 'p1-copy' });
  assert.deepEqual(copied.projects.map((item) => item.id), ['p1', 'p1-copy']);
  assert.equal(copied.projects[1].name, 'Imported（副本）');
});

