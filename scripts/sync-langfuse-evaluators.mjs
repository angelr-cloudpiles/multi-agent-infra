#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projects = JSON.parse(fs.readFileSync(path.join(root, 'services/agent-office/projects.json'))).projects;
const config = JSON.parse(fs.readFileSync(path.join(root, 'config/langfuse/evaluators.json')));
const selectedId = process.argv.find((arg) => arg.startsWith('--project='))?.slice(10);
const selected = selectedId ? projects.filter((project) => project.project_id === selectedId) : projects;
if (!selected.length) throw new Error('No configured project matched');
const host = process.env.LANGFUSE_HOST || 'https://langfuse.aiops.cloudpiles.net';

const secret = (id) => JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', id, '--query', 'SecretString', '--output', 'text'], {
  encoding: 'utf8', env: { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || 'aiops-aws', AWS_REGION: process.env.AWS_REGION || 'us-east-1' }, stdio: ['ignore', 'pipe', 'inherit']
}));
async function request(keys, method, pathname, body) {
  const response = await fetch(`${host}/api/public${pathname}`, { method, headers: { Authorization: `Basic ${Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64')}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${pathname} failed with ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
  return payload;
}
for (const project of selected) {
  const langfuse = secret(project.langfuse.keys_secret_id);
  await request(langfuse, 'PUT', '/llm-connections', { provider: config.provider, adapter: config.adapter, secretKey: config.secret_key, config: config.connection_config, customModels: [config.model], withDefaultModels: false });
  const current = await request(langfuse, 'GET', '/v2/evaluators?limit=100');
  const evaluatorIds = [];
  for (const definition of config.evaluators) {
    const name = `${definition.name} (${project.project_id})`;
    let evaluator = current.data?.find((item) => item.name === name);
    const body = { name, description: definition.description, type: 'llm_as_judge', prompt: definition.prompt, variableMapping: definition.variable_mapping, modelConfig: { provider: config.provider, model: config.model }, outputDefinition: definition.output_definition };
    if (!evaluator) evaluator = await request(langfuse, 'POST', '/v2/evaluators', body);
    else evaluator = await request(langfuse, 'PATCH', `/v2/evaluators/${evaluator.id}`, body);
    evaluatorIds.push(evaluator.id);
  }
  const rules = await request(langfuse, 'GET', '/v2/evaluation-rules?limit=100');
  const name = `Agent Office generations (${project.project_id})`;
  const body = { name, enabled: true, sampling: config.sampling, filter: [{ type: 'stringOptions', column: 'type', operator: 'any of', value: ['GENERATION'] }], evaluatorAssignments: evaluatorIds.map((evaluatorId) => ({ evaluatorId, variableMapping: null })) };
  const rule = rules.data?.find((item) => item.name === name);
  if (rule) await request(langfuse, 'PATCH', `/v2/evaluation-rules/${rule.id}`, body);
  else await request(langfuse, 'POST', '/v2/evaluation-rules', body);
  process.stdout.write(`${project.project_id}\tconfigured-evaluation\t${evaluatorIds.length}-evaluators\n`);
}
