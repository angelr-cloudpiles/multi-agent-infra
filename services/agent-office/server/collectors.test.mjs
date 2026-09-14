import test from 'node:test';
import assert from 'node:assert/strict';
import { observationEvent } from './collectors.mjs';

test('v4 observation collector retains project, trace, run and generation cost fields', () => {
  const observed = observationEvent({ project_id: 'tattoo-studio' }, { id: 'obs-1', traceId: 'trace-1', type: 'GENERATION', totalCost: '0.00012', startTime: '2026-09-14T12:00:00.000Z', metadata: { run_id: 'run-1', agent_id: 'research-agent' } });
  assert.equal(observed.id, 'observation-tattoo-studio-obs-1');
  assert.deepEqual(observed.value, { trace_id: 'trace-1', observation_id: 'obs-1', type: 'GENERATION', cost_usd: '0.00012' });
  assert.equal(observed.input.run_id, 'run-1');
  assert.equal(observed.input.agent_id, 'research-agent');
  assert.equal(observed.input.type, 'observation.observed');
});
