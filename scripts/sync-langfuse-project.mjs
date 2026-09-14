#!/usr/bin/env node
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projects = JSON.parse(fs.readFileSync(path.join(root, 'services/agent-office/projects.json')));
const {policy} = await import(path.join(root, 'services/agent-office/server/policy.mjs'));
const control = JSON.parse(fs.readFileSync(path.join(root, 'config/langfuse/projects.json')));
const agentDirectory = path.join(root, 'agentcore');
const langfuseHost = process.env.LANGFUSE_HOST || 'https://langfuse.aiops.cloudpiles.net';
const args = new Set(process.argv.slice(2));
const chosen = [...args].find((arg) => arg.startsWith('--project='))?.slice('--project='.length);
const dryRun = args.has('--dry-run');
if ([...args].some((arg) => !['--dry-run', '--all'].includes(arg) && !arg.startsWith('--project='))) throw new Error('Usage: sync-langfuse-project.mjs [--project=<id>|--all] [--dry-run]');
const selected = chosen ? projects.projects.filter((project) => project.project_id === chosen) : projects.projects;
if (!selected.length) throw new Error('No configured project matched');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const request = async (keys, method, pathname, body) => {
  if (dryRun) return { dryRun: true };
  const response = await fetch(`${langfuseHost}/api/public${pathname}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64')}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${method} ${pathname} failed with ${response.status}: ${JSON.stringify(payload).slice(0, 600)}`);
  return payload;
};
const loadKeys = (secretId) => JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', secretId, '--query', 'SecretString', '--output', 'text'], {
  encoding: 'utf8',
  env: { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || 'aiops-aws', AWS_REGION: process.env.AWS_REGION || 'us-east-1' },
  stdio: ['ignore', 'pipe', 'inherit']
}));
const log = (project, action, name) => process.stdout.write(`${project.project_id}\t${action}\t${name}\n`);
const promptText = (agentId) => {
  if (agentId === 'ui-design-agent') return control.ui_design_agent_prompt;
  const spec = JSON.parse(fs.readFileSync(path.join(agentDirectory, `${agentId}.json`)));
  const text = spec.systemPrompt?.map((block) => block.text).filter(Boolean).join('\n');
  if (!text) throw new Error(`Missing system prompt for ${agentId}`);
  return text;
};

async function syncProject(project) {
  const keys = dryRun ? null : loadKeys(project.langfuse.keys_secret_id);
  const context = fs.readFileSync(path.join(root, 'services/agent-office/project-contexts', project.context_file), 'utf8');
  const contextHash = sha256(context);
  const repository = project.context_source?.repository || null;
  const revision = project.context_source?.revision || null;
  const agentIds = project.allowed_agents;

  const existingScores = dryRun ? { data: [] } : await request(keys, 'GET', '/score-configs?limit=100');
  for (const score of control.scores) {
    if ((existingScores.data || []).some((item) => item.name === score.name)) { log(project, 'kept-score', score.name); continue; }
    await request(keys, 'POST', '/score-configs', score);
    log(project, dryRun ? 'plan-score' : 'created-score', score.name);
  }

  // Cost definitions are synchronized separately from verified AWS Price List
  // data. Keep the model policy visible in each project even if a new provider
  // model is awaiting a published AWS rate.
  for (const [alias, modelId] of Object.entries(policy.aliases)) {
    const modelName = `agent-office-${alias}`;
    log(project, 'declared-model-policy', `${modelName}=${modelId}`);
  }

  const existingDatasets = dryRun ? { data: [] } : await request(keys, 'GET', '/datasets?limit=100');
  for (const dataset of control.datasets) {
    if ((existingDatasets.data || []).some((item) => item.name === dataset.name)) { log(project, 'kept-dataset', dataset.name); continue; }
    await request(keys, 'POST', '/datasets', { ...dataset, metadata: { managed_by: control.managed_by, project_id: project.project_id } });
    log(project, dryRun ? 'plan-dataset' : 'created-dataset', dataset.name);
  }
  const contextItem = {
    datasetName: 'agent-office-project-context',
    id: `agent-office-context-${project.project_id}`,
    input: { context },
    metadata: { managed_by: control.managed_by, project_id: project.project_id, repository, revision, sha256: contextHash, access_mode: project.access_mode },
    status: 'ACTIVE'
  };
  await request(keys, 'POST', '/dataset-items', contextItem);
  log(project, dryRun ? 'plan-item' : 'upserted-item', contextItem.id);

  for (const agentId of agentIds) {
    const alias = policy.agents[agentId]?.alias;
    if (!alias) throw new Error(`No model policy for ${agentId}`);
    const text = promptText(agentId);
    const config = { managed_by: control.managed_by, project_id: project.project_id, agent_id: agentId, model_alias: alias, model_id: policy.aliases[alias], repository, revision, context_sha256: contextHash, access_mode: project.access_mode, managed_source_sha256: sha256(JSON.stringify({ text, agentId, alias, repository, revision, contextHash, accessMode: project.access_mode })) };
    const promptName = `agents.${agentId}.system`;
    const current = dryRun ? null : await request(keys, 'GET', `/v2/prompts/${encodeURIComponent(promptName)}?label=${control.prompt_labels.sync}`);
    if (current?.config?.managed_source_sha256 === config.managed_source_sha256) { log(project, 'kept-prompt', promptName); }
    else {
      await request(keys, 'POST', '/prompts', { name: promptName, type: 'chat', prompt: [{ role: 'system', content: text }], isActive: true, labels: [control.prompt_labels.sync], tags: ['agent-office', `project:${project.project_id}`, `agent:${agentId}`], config, commitMessage: `Agent Office sync ${config.managed_source_sha256.slice(0, 12)}` });
      log(project, dryRun ? 'plan-prompt' : 'published-prompt', promptName);
    }
    const contractItem = {
      datasetName: 'agent-office-agent-contracts',
      id: `agent-office-contract-${project.project_id}-${agentId}`,
      input: { task: `Evaluate the ${agentId} contract for ${project.display_name}.` },
      expectedOutput: { agent_id: agentId, model_alias: alias, access_mode: project.access_mode, requires_evidence: true },
      metadata: { managed_by: control.managed_by, project_id: project.project_id, prompt_name: promptName, model_id: policy.aliases[alias], repository, revision },
      status: 'ACTIVE'
    };
    await request(keys, 'POST', '/dataset-items', contractItem);
    log(project, dryRun ? 'plan-item' : 'upserted-item', contractItem.id);
  }
}

for (const project of selected) await syncProject(project);
