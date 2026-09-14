const COORDINATOR = 'orchestrator-agent';
const NON_DELEGATE_AGENTS = new Set([COORDINATOR, 'deploy-agent']);

export function executionPlan(run, project) {
  const allowed = new Set(project.allowed_agents);
  if (!allowed.has(run.agent_id)) throw new Error('Run agent is not enabled for this project');

  // Follow-up chat turns remain with the selected agent; they do not create another parallel task.
  if (run.continuation_kind === 'conversation_message' || run.continuation_kind === 'synthesize_existing') return { parallel: [run.agent_id], synthesizer: null };
  const collaborative = run.agent_id === COORDINATOR || run.mode === 'meeting';
  if (!collaborative) return { parallel: [run.agent_id], synthesizer: null };

  const delegates = project.allowed_agents.filter((agentId) => !NON_DELEGATE_AGENTS.has(agentId));
  if (!delegates.length) return { parallel: [run.agent_id], synthesizer: null };

  return {
    parallel: delegates,
    synthesizer: allowed.has(COORDINATOR) ? COORDINATOR : null
  };
}
