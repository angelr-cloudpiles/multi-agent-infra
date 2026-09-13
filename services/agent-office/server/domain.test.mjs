import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateRun,normalizeEvent,mayApprove} from './domain.mjs';
const policy=JSON.parse(fs.readFileSync(new URL('../model-policy.json',import.meta.url)));
test('untrusted callers cannot inject model endpoints, skills or limits',()=>{
 for(const field of ['model','skills','maxTokens','environment','project_id','tools'])assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',[field]:{}},policy));
 assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',alias:'agent-critical-review'},policy));
 assert.equal(validateRun({prompt:'hello',agent_id:'review-agent',alias:'agent-critical-review'},policy).alias,'agent-critical-review');
});
test('event scope is fixed by trusted ingestion',()=>{
 const e=normalizeEvent({type:'task.started',source:'agentcore',project_id:'evil',environment:'dev',state:'working'});
 assert.equal(e.project_id,'multi-agent');assert.equal(e.environment,'production');assert.ok(e.run_id);assert.throws(()=>normalizeEvent({type:'x',source:'unknown'}));
});
test('approval requires approver group and independent reviewer',()=>{
 assert.equal(mayApprove({sub:'a','cognito:groups':['aiops-approvers']},{requested_by:'a'}),false);
 assert.equal(mayApprove({sub:'b','cognito:groups':[]},{requested_by:'a'}),false);
 assert.equal(mayApprove({sub:'b','cognito:groups':['aiops-approvers']},{requested_by:'a'}),true);
});
