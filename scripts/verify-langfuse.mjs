#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const keys = JSON.parse(execFileSync('aws', [
  'secretsmanager', 'get-secret-value',
  '--secret-id', 'multi-agent-langfuse-keys',
  '--query', 'SecretString', '--output', 'text'
], {
  encoding: 'utf8',
  env: { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || 'aiops-aws', AWS_REGION: process.env.AWS_REGION || 'us-east-1' },
  stdio: ['ignore', 'pipe', 'inherit']
}));

const toStartTime = new Date();
const fromStartTime = new Date(toStartTime.getTime() - 24 * 60 * 60 * 1000);
const endpoint = new URL('https://langfuse.aiops.cloudpiles.net/api/public/v2/observations');
endpoint.search = new URLSearchParams({
  fromStartTime: fromStartTime.toISOString(),
  toStartTime: toStartTime.toISOString(),
  fields: 'core,basic,trace_context',
  limit: '1'
});
const response = await fetch(endpoint, {
  headers: { Authorization: `Basic ${Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64')}` },
  signal: AbortSignal.timeout(30000)
});
if (!response.ok) throw new Error(`Langfuse v4 Observations API failed with ${response.status}`);
const payload = await response.json();
process.stdout.write(`Langfuse v4 Observations API verified: ${(payload.data || []).length} observations in the last 24 hours\n`);
