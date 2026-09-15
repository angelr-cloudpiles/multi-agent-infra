#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'services/agent-office/projects.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'config/codex-history-import.json'), 'utf8'));
const { projectFor } = await import(path.join(root, 'services/agent-office/server/projects.mjs'));
const { recordLangfuseV4HistoricalImport, flushLangfuseV4Providers } = await import(path.join(root, 'services/agent-office/server/langfuse-v4.mjs'));

const args = new Set(process.argv.slice(2));
const selectedProjectId = [...args].find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
const dryRun = args.has('--dry-run');
if ([...args].some((arg) => !['--dry-run', '--all'].includes(arg) && !arg.startsWith('--project='))) {
  throw new Error('Usage: import-codex-history.mjs [--project=<id>|--all] [--dry-run]');
}
if (!Array.isArray(manifest.records) || !manifest.records.length) throw new Error('No Codex historical records configured');
const records = selectedProjectId ? manifest.records.filter((record) => record.project_id === selectedProjectId) : manifest.records;
if (!records.length) throw new Error(`No configured historical record matched ${selectedProjectId}`);
const configuredProjects = new Set(registry.projects.map((project) => project.project_id));
for (const record of records) {
  if (!configuredProjects.has(record.project_id)) throw new Error(`Historical record references an unknown project: ${record.project_id}`);
  if (!record.codex_thread_id || !record.title || !record.summary || Number.isNaN(new Date(record.observed_at).getTime())) {
    throw new Error(`Historical record for ${record.project_id} is incomplete`);
  }
}

const host = (process.env.LANGFUSE_BASE_URL || 'https://langfuse.aiops.cloudpiles.net').replace(/\/$/, '');
const awsEnv = { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || 'aiops-aws', AWS_REGION: process.env.AWS_REGION || 'us-east-1' };

function loadKeys(secretId) {
  const keys = JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', secretId, '--query', 'SecretString', '--output', 'text'], {
    encoding: 'utf8', env: awsEnv, stdio: ['ignore', 'pipe', 'inherit']
  }));
  if (!keys.public_key || !keys.secret_key) throw new Error(`Secret ${secretId} does not contain Langfuse project credentials`);
  return keys;
}

async function existingThreadIds(keys, record) {
  const start = new Date(new Date(record.observed_at).getTime() - 86_400_000).toISOString();
  const end = new Date(new Date(record.observed_at).getTime() + 86_400_000).toISOString();
  const found = new Set();
  let cursor;
  do {
    const endpoint = new URL('/api/public/v2/observations', host);
    endpoint.search = new URLSearchParams({ fromStartTime: start, toStartTime: end, fields: 'core,basic,metadata', limit: '100', ...(cursor ? { cursor } : {}) });
    const authorization = Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64');
    const response = await fetch(endpoint, { headers: { Authorization: `Basic ${authorization}` }, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Langfuse observation lookup failed with ${response.status} for ${record.project_id}`);
    const page = await response.json();
    for (const observation of page.data || []) {
      const metadata = observation.metadata || {};
      if (metadata.source === 'codex-historical-import' && metadata.codex_thread_id) found.add(metadata.codex_thread_id);
    }
    cursor = page.meta?.nextCursor;
  } while (cursor);
  return found;
}

const results = [];
for (const record of records) {
  const project = projectFor(record.project_id);
  if (dryRun) {
    results.push({ project_id: record.project_id, codex_thread_id: record.codex_thread_id, action: 'would-import', scope: manifest.privacy.scope });
    continue;
  }
  const keys = loadKeys(project.langfuse.keys_secret_id);
  const existing = await existingThreadIds(keys, record);
  if (existing.has(record.codex_thread_id)) {
    results.push({ project_id: record.project_id, codex_thread_id: record.codex_thread_id, action: 'skipped-existing' });
    continue;
  }
  const imported = await recordLangfuseV4HistoricalImport({ project, keys, record });
  await flushLangfuseV4Providers();
  results.push({ project_id: record.project_id, codex_thread_id: record.codex_thread_id, action: 'imported', trace_id: imported.traceId, observation_id: imported.observationId });
}
process.stdout.write(`${JSON.stringify({ source: manifest.source, privacy: manifest.privacy, results })}\n`);
