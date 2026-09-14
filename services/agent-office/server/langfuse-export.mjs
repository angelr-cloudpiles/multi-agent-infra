import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import parquet from 'parquetjs-lite';

const { ParquetSchema, ParquetWriter } = parquet;

const region = process.env.AWS_REGION || 'us-east-1';
const secrets = new SecretsManagerClient({ region });
const storage = new S3Client({ region });
const observationFields = ['core', 'basic', 'time', 'metadata', 'model', 'usage', 'metrics', 'trace_context'];
const schema = new ParquetSchema(Object.fromEntries([
  'record_type', 'project_id', 'export_date', 'exported_at', 'id', 'trace_id', 'parent_observation_id', 'observation_type',
  'name', 'environment', 'level', 'status_message', 'start_time', 'end_time', 'created_at', 'updated_at', 'user_id',
  'session_id', 'model', 'metadata_json', 'usage_json', 'cost_json', 'trace_context_json', 'score_name', 'score_value',
  'score_data_type', 'score_source', 'score_subject_json'
].map((name) => [name, { type: 'UTF8', optional: true }])));

function asText(value) { return value === undefined || value === null ? undefined : String(value); }
function asJson(value) { return value === undefined || value === null ? undefined : JSON.stringify(value); }

export function exportWindow(exportDate) {
  const date = exportDate || new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('EXPORT_DATE must use YYYY-MM-DD');
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf())) throw new Error('EXPORT_DATE is invalid');
  return { date, start: start.toISOString(), end: new Date(start.valueOf() + 86_400_000).toISOString() };
}

export function observationRow(item, { projectId, date, exportedAt }) {
  return {
    record_type: 'observation', project_id: projectId, export_date: date, exported_at: exportedAt,
    id: asText(item.id), trace_id: asText(item.traceId), parent_observation_id: asText(item.parentObservationId),
    observation_type: asText(item.type), name: asText(item.name), environment: asText(item.environment), level: asText(item.level),
    status_message: asText(item.statusMessage), start_time: asText(item.startTime), end_time: asText(item.endTime),
    created_at: asText(item.createdAt), updated_at: asText(item.updatedAt), user_id: asText(item.userId), session_id: asText(item.sessionId),
    model: asText(item.model), metadata_json: asJson(item.metadata), usage_json: asJson(item.usageDetails), cost_json: asJson(item.costDetails),
    trace_context_json: asJson({ tags: item.tags, release: item.release, traceName: item.traceName })
  };
}

export function scoreRow(item, { projectId, date, exportedAt }) {
  return {
    record_type: 'score', project_id: projectId, export_date: date, exported_at: exportedAt, id: asText(item.id),
    trace_id: asText(item.subject?.traceId), environment: asText(item.environment), created_at: asText(item.createdAt),
    updated_at: asText(item.updatedAt), start_time: asText(item.timestamp), score_name: asText(item.name), score_value: asText(item.value),
    score_data_type: asText(item.dataType), score_source: asText(item.source), score_subject_json: asJson(item.subject), metadata_json: asJson(item.metadata)
  };
}

export async function listPages(request, endpoint, params) {
  const all = [];
  let cursor;
  do {
    const page = await request(endpoint, { ...params, limit: '100', ...(cursor ? { cursor } : {}) });
    all.push(...(page.data || []));
    cursor = page.meta?.nextCursor;
  } while (cursor);
  return all;
}

async function readSecret(secretId) {
  const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretId }));
  const value = JSON.parse(result.SecretString || '{}');
  if (!value.public_key || !value.secret_key) throw new Error(`Secret ${secretId} does not contain Langfuse project credentials`);
  return value;
}

function apiRequest(keys) {
  const host = process.env.LANGFUSE_EXPORT_HOST || 'https://langfuse.aiops.cloudpiles.net';
  return async (endpoint, params) => {
    const url = new URL(`/api/public${endpoint}`, host);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const authorization = Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64');
    const response = await fetch(url, { headers: { Authorization: `Basic ${authorization}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Langfuse ${endpoint} returned ${response.status}`);
    return response.json();
  };
}

async function writeParquet(records) {
  const file = path.join(os.tmpdir(), `langfuse-export-${crypto.randomUUID()}.parquet`);
  const writer = await ParquetWriter.openFile(schema, file);
  try { for (const record of records) await writer.appendRow(record); } finally { await writer.close(); }
  try { return await fs.readFile(file); } finally { await fs.rm(file, { force: true }); }
}

async function putObject({ bucket, key, body, contentType }) {
  await storage.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, ServerSideEncryption: 'aws:kms' }));
}

export async function exportProject(project, window, { request, upload = putObject, now = () => new Date() } = {}) {
  const exportedAt = now().toISOString();
  const client = request || apiRequest(await readSecret(project.secretId));
  const [observations, scores] = await Promise.all([
    listPages(client, '/v2/observations', { fromStartTime: window.start, toStartTime: window.end, fields: observationFields.join(',') }),
    listPages(client, '/v3/scores', { fromTimestamp: window.start, toTimestamp: window.end, fields: 'details,subject' })
  ]);
  const prefix = (process.env.LANGFUSE_EXPORT_PREFIX || 'exports/project-api').replace(/^\/+|\/+$/g, '');
  const bucket = process.env.LANGFUSE_EXPORT_BUCKET;
  if (!bucket) throw new Error('LANGFUSE_EXPORT_BUCKET is required');
  const scope = { projectId: project.projectId, date: window.date, exportedAt };
  const outputs = [
    { name: 'observations', records: observations.map((item) => observationRow(item, scope)) },
    { name: 'scores', records: scores.map((item) => scoreRow(item, scope)) }
  ];
  const manifest = { project_id: project.projectId, export_date: window.date, exported_at: exportedAt, format: 'parquet', includes: ['observations', 'scores'], excludes: ['input', 'output'], objects: [] };
  for (const output of outputs) {
    const body = await writeParquet(output.records);
    const key = `${prefix}/${project.projectId}/date=${window.date}/${output.name}.parquet`;
    await upload({ bucket, key, body, contentType: 'application/vnd.apache.parquet' });
    manifest.objects.push({ key, records: output.records.length, sha256: crypto.createHash('sha256').update(body).digest('hex') });
  }
  const manifestKey = `${prefix}/${project.projectId}/date=${window.date}/manifest.json`;
  await upload({ bucket, key: manifestKey, body: Buffer.from(JSON.stringify(manifest)), contentType: 'application/json' });
  return { ...manifest, manifest_key: manifestKey };
}

export async function main() {
  const projects = JSON.parse(process.env.LANGFUSE_EXPORT_PROJECTS || '[]');
  if (!Array.isArray(projects) || !projects.length) throw new Error('LANGFUSE_EXPORT_PROJECTS must define at least one project');
  const window = exportWindow(process.env.EXPORT_DATE);
  const results = [];
  for (const project of projects) {
    if (!project.projectId || !project.secretId) throw new Error('Each export project requires projectId and secretId');
    results.push(await exportProject(project, window));
  }
  process.stdout.write(`${JSON.stringify({ export_date: window.date, projects: results.map(({ project_id, objects, manifest_key }) => ({ project_id, manifest_key, objects: objects.map(({ key, records }) => ({ key, records })) })) })}\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`Langfuse export failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
