import { randomUUID } from 'node:crypto';
export const STATES = new Set(['idle','queued','working','waiting_for_tool','waiting_for_approval','reviewing','meeting','error','paused']);
export const SOURCES = new Set(['orchestrator','litellm','langfuse','ecs','cicd','agentcore','office']);
export function normalizeEvent(input, scope = {project_id:'multi-agent',environment:'production'}) {
  if (!SOURCES.has(input.source)) throw new Error('Invalid event source');
  if (input.state && !STATES.has(input.state)) throw new Error('Invalid agent state');
  if (!input.type || typeof input.type !== 'string') throw new Error('Event type required');
  return {...input, ...scope, event_id:input.event_id || randomUUID(), run_id:input.run_id || 'system', agent_id:input.agent_id || 'platform', timestamp:input.timestamp || new Date().toISOString(), schema_version:1};
}
export function validateRun(body, policy, project) {
  const allowed = new Set(['prompt','agent_id','alias','mode','project_id']);
  if (!body || Object.keys(body).some(k=>!allowed.has(k))) throw new Error('Unsupported request field');
  if (typeof body.prompt !== 'string' || body.prompt.trim().length<3 || body.prompt.length>12000) throw new Error('Prompt must contain 3–12000 characters');
  if (body.project_id && body.project_id !== project.project_id) throw new Error('Project does not match the trusted request scope');
  if (!project.allowed_agents.includes(body.agent_id)) throw new Error('Agent is not enabled for this project');
  if (!Object.hasOwn(policy.agents, body.agent_id)) throw new Error('Unknown agent');
  const cfg=policy.agents[body.agent_id];
  const alias=body.alias || cfg.alias;
  if (![cfg.alias,...cfg.escalations].includes(alias)) throw new Error('Model override is not permitted');
  if (body.mode && !project.allowed_modes.includes(body.mode)) throw new Error('Mode is not enabled for this project');
  return {prompt:body.prompt.trim(),agent_id:body.agent_id,alias,mode:body.mode || 'task',project_id:project.project_id,environment:project.environment,access_mode:project.access_mode};
}
export function mayApprove(claims, run) {
  return (claims['cognito:groups'] || []).includes('aiops-approvers') && claims.sub !== run.requested_by;
}
export function publicError(error) { return {error:error.name === 'ConditionalCheckFailedException'?'The operation is already claimed or completed':'Operation failed',code:error.name || 'Error'}; }
