#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(fs.readFileSync(path.join(root, 'services/agent-office/projects.json')));
const control = JSON.parse(fs.readFileSync(path.join(root, 'config/langfuse/projects.json')));
const args = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--') && arg.includes('=')).map((arg) => {
  const [key, ...value] = arg.slice(2).split('=');
  return [key, value.join('=')];
}));
const dryRun = process.argv.includes('--dry-run');
const projectId = args.project;
const promptName = args.prompt;
const version = Number(args.version);
const reportPath = args['evaluation-report'];

if (!projectId || !promptName || !Number.isInteger(version) || version < 1 || !reportPath) {
  throw new Error('Usage: promote-langfuse-prompt.mjs --project=<id> --prompt=<name> --version=<n> --evaluation-report=<file.json> [--dry-run]');
}

const project = registry.projects.find((item) => item.project_id === projectId);
if (!project) throw new Error(`Unknown project: ${projectId}`);
const report = JSON.parse(fs.readFileSync(path.resolve(reportPath)));
const policy = control.prompt_promotion;
const failures = [];
if (report.project_id !== projectId) failures.push('report project_id does not match');
if (report.prompt_name !== promptName) failures.push('report prompt_name does not match');
if (report.version !== version) failures.push('report version does not match');
if (!Number.isInteger(report.dataset_items) || report.dataset_items < policy.minimum_dataset_items) failures.push(`dataset_items must be at least ${policy.minimum_dataset_items}`);
if (report.task_success_rate < policy.minimum_task_success_rate) failures.push(`task_success_rate must be at least ${policy.minimum_task_success_rate}`);
if (report.response_quality < policy.minimum_response_quality) failures.push(`response_quality must be at least ${policy.minimum_response_quality}`);
if (report.evidence_coverage < policy.minimum_evidence_coverage) failures.push(`evidence_coverage must be at least ${policy.minimum_evidence_coverage}`);
if (report.requires_intervention_rate > policy.maximum_requires_intervention_rate) failures.push(`requires_intervention_rate must be at most ${policy.maximum_requires_intervention_rate}`);
if (report.safety_review !== policy.required_safety_review) failures.push(`safety_review must equal ${policy.required_safety_review}`);
if (failures.length) throw new Error(`Prompt promotion rejected: ${failures.join('; ')}`);

const keys = JSON.parse(execFileSync('aws', ['secretsmanager', 'get-secret-value', '--secret-id', project.langfuse.keys_secret_id, '--query', 'SecretString', '--output', 'text'], {
  encoding: 'utf8',
  env: { ...process.env, AWS_PROFILE: process.env.AWS_PROFILE || 'aiops-aws', AWS_REGION: process.env.AWS_REGION || 'us-east-1' },
  stdio: ['ignore', 'pipe', 'inherit']
}));
const authorization = `Basic ${Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64')}`;
const host = process.env.LANGFUSE_HOST || 'https://langfuse.aiops.cloudpiles.net';
const get = await fetch(`${host}/api/public/v2/prompts/${encodeURIComponent(promptName)}?version=${version}`, { headers: { Authorization: authorization }, signal: AbortSignal.timeout(20000) });
if (!get.ok) throw new Error(`Prompt lookup failed with ${get.status}`);
const staged = await get.json();
if (!staged.labels?.includes(control.prompt_labels.sync)) throw new Error(`Prompt version ${version} is not labeled ${control.prompt_labels.sync}`);
const labels = [...new Set([...(staged.labels || []).filter((label) => label !== 'latest'), control.prompt_labels.sync, control.prompt_labels.runtime])];
if (dryRun) {
  process.stdout.write(JSON.stringify({ project_id: projectId, prompt_name: promptName, version, action: 'would-promote', labels }, null, 2) + '\n');
} else {
  const response = await fetch(`${host}/api/public/v2/prompts/${encodeURIComponent(promptName)}/versions/${version}`, {
    method: 'PATCH',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: JSON.stringify({ newLabels: labels }),
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Prompt promotion failed with ${response.status}: ${(await response.text()).slice(0, 500)}`);
  process.stdout.write(JSON.stringify({ project_id: projectId, prompt_name: promptName, version, action: 'promoted', labels }, null, 2) + '\n');
}
