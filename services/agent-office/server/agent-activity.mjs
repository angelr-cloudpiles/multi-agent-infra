export const ACTIVE_TASK_STATUSES = new Set(['queued', 'working', 'waiting_for_approval', 'paused', 'error']);

function newest(items, selector) {
  const value = typeof selector === 'function' ? selector : (item) => item[selector];
  return [...items].sort((left, right) => String(value(right) || '').localeCompare(String(value(left) || '')))[0];
}

// Continuation runs are implementation details of their root task.  They must
// never leave an agent marked as requiring attention after the root was closed.
export function activityForAgent(projects, agentId) {
  const entries = projects.map(({ project, runs, events }) => {
    const roots = runs.filter((run) => !run.continuation_kind);
    const run = newest(roots.filter((item) => item.agent_id === agentId && ACTIVE_TASK_STATUSES.has(item.status)), 'created_at');
    const event = newest(events.filter((item) => item.agent_id === agentId), 'timestamp');
    if (!run && !event) return null;
    return { project_id: project.project_id, project_name: project.display_name, run, event };
  }).filter(Boolean);
  const active = newest(entries.filter((entry) => entry.run), (entry) => entry.run.created_at);
  const latest = newest(entries, (entry) => entry.event?.timestamp || entry.run?.created_at) || active;
  return {
    state: active?.run.status || 'idle',
    active_run_id: active?.run?.run_id || null,
    active_task_id: active?.run?.run_id || null,
    active_project_id: active?.project_id || latest?.project_id || null,
    active_project_name: active?.project_name || latest?.project_name || null,
    task: active?.run?.prompt || null,
    event: latest?.event?.type || null,
    projects: entries.map((entry) => ({
      project_id: entry.project_id,
      project_name: entry.project_name,
      state: entry.run?.status || 'idle',
      task: entry.run?.prompt || null
    }))
  };
}
