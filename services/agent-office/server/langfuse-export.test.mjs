import test from 'node:test';
import assert from 'node:assert/strict';
import { exportProject, exportWindow, listPages, observationRow, scoreRow } from './langfuse-export.mjs';

test('export window is the complete requested UTC day', () => {
  assert.deepEqual(exportWindow('2026-09-14'), { date: '2026-09-14', start: '2026-09-14T00:00:00.000Z', end: '2026-09-15T00:00:00.000Z' });
  assert.throws(() => exportWindow('14-09-2026'), /YYYY-MM-DD/);
});

test('observation export omits prompt input and output', () => {
  const row = observationRow({ id: 'obs', traceId: 'trace', type: 'GENERATION', input: { secret: 'never export' }, output: { text: 'never export' }, metadata: { project_id: 'tattoo-studio' } }, { projectId: 'tattoo-studio', date: '2026-09-14', exportedAt: '2026-09-15T03:10:00.000Z' });
  assert.equal(row.id, 'obs');
  assert.equal(row.trace_id, 'trace');
  assert.equal(JSON.stringify(row).includes('never export'), false);
});

test('score export keeps the score subject without unrelated fields', () => {
  const row = scoreRow({ id: 'score', name: 'safety_review', value: 'pass', dataType: 'CATEGORICAL', subject: { kind: 'observation', id: 'obs', traceId: 'trace' } }, { projectId: 'tattoo-studio', date: '2026-09-14', exportedAt: '2026-09-15T03:10:00.000Z' });
  assert.equal(row.score_value, 'pass');
  assert.equal(row.trace_id, 'trace');
});

test('pagination consumes every Langfuse page', async () => {
  const calls = [];
  const records = await listPages(async (_endpoint, params) => {
    calls.push(params.cursor || 'first');
    return params.cursor ? { data: [{ id: 'two' }], meta: {} } : { data: [{ id: 'one' }], meta: { nextCursor: 'next' } };
  }, '/v2/observations', { fields: 'core' });
  assert.deepEqual(records.map((item) => item.id), ['one', 'two']);
  assert.deepEqual(calls, ['first', 'next']);
});

test('project export writes parquet and a manifest without observation IO', async () => {
  const priorBucket = process.env.LANGFUSE_EXPORT_BUCKET;
  process.env.LANGFUSE_EXPORT_BUCKET = 'test-bucket';
  const uploaded = [];
  try {
    const manifest = await exportProject({ projectId: 'tattoo-studio', secretId: 'unused' }, exportWindow('2026-09-14'), {
      now: () => new Date('2026-09-15T03:10:00.000Z'),
      request: async (endpoint) => endpoint.includes('observations')
        ? { data: [{ id: 'obs', type: 'GENERATION', input: { content: 'private' }, output: { content: 'private' } }], meta: {} }
        : { data: [{ id: 'score', name: 'safety_review', value: 'pass', dataType: 'CATEGORICAL' }], meta: {} },
      upload: async (object) => uploaded.push(object)
    });
    assert.equal(uploaded.length, 3);
    assert.deepEqual(manifest.objects.map((item) => item.records), [1, 1]);
    assert.match(uploaded[0].key, /observations\.parquet$/);
    assert.match(uploaded[1].key, /scores\.parquet$/);
    assert.equal(uploaded[2].key, manifest.manifest_key);
    assert.equal(uploaded[0].body.includes(Buffer.from('private')), false);
  } finally {
    if (priorBucket === undefined) delete process.env.LANGFUSE_EXPORT_BUCKET;
    else process.env.LANGFUSE_EXPORT_BUCKET = priorBucket;
  }
});
