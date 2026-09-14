import { createHash, randomUUID } from 'node:crypto';
export const STATES = new Set(['idle','queued','working','waiting_for_tool','waiting_for_approval','reviewing','meeting','error','paused']);
export const SOURCES = new Set(['orchestrator','langfuse','ecs','cicd','agentcore','office']);
export const ASSISTABLE_STATUSES = new Set(['paused','error','waiting_for_approval']);
export const rootTaskId=run=>run?.parent_task_id || run?.parent_run_id || null;
export function normalizeEvent(input, scope = {project_id:'multi-agent',environment:'production'}) {
  if (!SOURCES.has(input.source)) throw new Error('Invalid event source');
  if (input.state && !STATES.has(input.state)) throw new Error('Invalid agent state');
  if (!input.type || typeof input.type !== 'string') throw new Error('Event type required');
  return {...input, ...scope, event_id:input.event_id || randomUUID(), run_id:input.run_id || 'system', agent_id:input.agent_id || 'platform', timestamp:input.timestamp || new Date().toISOString(), schema_version:1};
}
export function validateRun(body, policy, project) {
  const allowed = new Set(['prompt','agent_id','alias','mode','project_id','attachments']);
  if (!body || Object.keys(body).some(k=>!allowed.has(k))) throw new Error('Unsupported request field');
  if (typeof body.prompt !== 'string' || body.prompt.trim().length<3 || body.prompt.length>12000) throw new Error('Prompt must contain 3–12000 characters');
  if (body.project_id && body.project_id !== project.project_id) throw new Error('Project does not match the trusted request scope');
  if (!project.allowed_agents.includes(body.agent_id)) throw new Error('Agent is not enabled for this project');
  if (!Object.hasOwn(policy.agents, body.agent_id)) throw new Error('Unknown agent');
  const cfg=policy.agents[body.agent_id];
  const alias=body.alias || cfg.alias;
  if (![cfg.alias,...cfg.escalations].includes(alias)) throw new Error('Model override is not permitted');
  if (body.mode && !project.allowed_modes.includes(body.mode)) throw new Error('Mode is not enabled for this project');
  if(body.attachments && (!Array.isArray(body.attachments)||body.attachments.length>10||body.attachments.some(attachment=>!attachment?.attachment_id||typeof attachment.name!=='string'||typeof attachment.s3_uri!=='string'))) throw new Error('Invalid attachments');
  return {prompt:body.prompt.trim(),agent_id:body.agent_id,alias,mode:body.mode || 'task',project_id:project.project_id,environment:project.environment,access_mode:project.access_mode,attachments:body.attachments || []};
}
export function mayApprove(claims, run) {
  return (claims['cognito:groups'] || []).includes('aiops-approvers') && claims.sub !== run.requested_by;
}
export function mayAssist(claims) {
  // Assistance only adds user context to a constrained continuation; production approval remains independently gated.
  return typeof claims?.sub === 'string' && claims.sub.length > 0;
}
export function validateAssistance(body) {
  if (!body || Object.keys(body).some(key => !['message', 'attachments'].includes(key))) throw new Error('Unsupported assistance field');
  if (body.attachments && (!Array.isArray(body.attachments) || body.attachments.length > 10 || body.attachments.some(id => typeof id !== 'string'))) throw new Error('Invalid attachments');
  const attachment_ids = body.attachments || [];
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message && attachment_ids.length) return { message: 'Review the attached assistance material.', attachment_ids };
  if (message.length < 3 || message.length > 4000) throw new Error('Assistance must contain 3–4000 characters');
  return { message, attachment_ids };
}
export function agentMemoryIdentity(projectId, agentId, userSub, taskId = 'default') {
  if (![projectId, agentId, userSub, taskId].every(value => typeof value === 'string' && value.length)) throw new Error('Memory identity requires project, agent, user, and task');
  const userHash = createHash('sha256').update(userSub).digest('hex').slice(0, 24);
  const taskHash = createHash('sha256').update(taskId).digest('hex').slice(0, 16);
  return {
    // Long-term facts are shared by the same user within one project. The raw Cognito subject never leaves Agent Office.
    actorId: `project-${projectId}-user-${userHash}`,
    // AgentCore memory remains scoped to a specialist, so its private working memory does not bleed to another agent.
    sessionId: `agent-office-runtime-${projectId}-${agentId}-${userHash}-${taskHash}`,
    // Langfuse replays the actual project conversation, including the specialists that participated in it.
    conversationId: `agent-office-conversation-${projectId}-${userHash}`
  };
}
export function publicError(error) { return {error:error.name === 'ConditionalCheckFailedException'?'The operation is already claimed or completed':'Operation failed',code:error.name || 'Error'}; }


export function agentFailureGuidance(errorName, completedAgents = []) {
  const code = String(errorName || 'Error');
  const cause = code === 'RuntimeClientError'
    ? 'AgentCore interrumpió la ejecución del modelo. El reintento automático ya se agotó; no es una falta de información de tu parte.'
    : code === 'AccessDeniedException'
      ? 'El runtime no tiene permiso para completar esta acción. El equipo debe corregir la configuración del runtime antes de reintentar.'
      : code === 'TimeoutError' || code.includes('exceeded')
        ? 'La ejecución superó su límite de tiempo o de iteraciones antes de terminar.'
        : `La ejecución se detuvo con el código ${code}.`;
  const completed = [...new Set(completedAgents.filter(Boolean))];
  const preserved = completed.length
    ? `Se conservaron los resultados de **${completed.join(', ')}**.`
    : 'No se produjo una respuesta utilizable en esta etapa.';
  return [
    '## Se necesita una decisión para continuar',
    cause,
    preserved,
    completed.length
      ? 'Podés **reintentar solo la síntesis** para no repetir el análisis, revisar los resultados disponibles o aportar una indicación adicional.'
      : 'Podés aportar una indicación, archivo o decisión para que el agente continúe con un nuevo intento.'
  ].join('\n\n');
}

export function canRetrySynthesis(run) {
  return Boolean(run && ['error', 'paused'].includes(run.status) && run.agent_id === 'orchestrator-agent');
}
