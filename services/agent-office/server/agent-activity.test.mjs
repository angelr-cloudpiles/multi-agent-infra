import test from 'node:test';
import assert from 'node:assert/strict';
import { activityForAgent } from './agent-activity.mjs';

const project = { project_id: 'tattoo-studio', display_name: 'Fede Rod Tattoo Studio' };

test('a failed continuation cannot keep a completed root task in attention', () => {
  const result = activityForAgent([{
    project,
    runs: [
      { run_id: 'root', agent_id: 'orchestrator-agent', status: 'completed', created_at: '2026-09-14T19:32:48Z' },
      { run_id: 'child', parent_task_id: 'root', continuation_kind: 'user_assistance', agent_id: 'orchestrator-agent', status: 'error', created_at: '2026-09-14T19:03:43Z' }
    ],
    events: [{ agent_id: 'orchestrator-agent', type: 'run.completed', timestamp: '2026-09-14T19:32:48Z' }]
  }], 'orchestrator-agent');
  assert.equal(result.state, 'idle');
  assert.equal(result.active_task_id, null);
  assert.equal(result.event, 'run.completed');
});

test('an unresolved root task remains visible as requiring attention', () => {
  const result = activityForAgent([{
    project,
    runs: [{ run_id: 'root', agent_id: 'orchestrator-agent', status: 'error', prompt: 'Revisar integración', created_at: '2026-09-14T20:00:00Z' }],
    events: [{ agent_id: 'orchestrator-agent', type: 'invocation.failed', timestamp: '2026-09-14T20:00:01Z' }]
  }], 'orchestrator-agent');
  assert.equal(result.state, 'error');
  assert.equal(result.active_task_id, 'root');
  assert.equal(result.task, 'Revisar integración');
});
