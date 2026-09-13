import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateRun,normalizeEvent,mayApprove} from './domain.mjs';
import {projectFor} from './projects.mjs';
const policy=JSON.parse(fs.readFileSync(new URL('../model-policy.json',import.meta.url)));
test('untrusted callers cannot inject model endpoints, skills or limits',()=>{
 const platform=projectFor('multi-agent');
 for(const field of ['model','skills','maxTokens','environment','tools'])assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',[field]:{}},policy,platform));
 assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',alias:'agent-critical-review'},policy,platform));
 assert.equal(validateRun({prompt:'hello',agent_id:'review-agent',alias:'agent-critical-review'},policy,platform).alias,'agent-critical-review');
});
test('project policy scopes runs before they enter the queue',()=>{
 const tattoo=projectFor('tattoo-studio');
 assert.throws(()=>validateRun({prompt:'review architecture',agent_id:'deploy-agent',project_id:'tattoo-studio'},policy,tattoo));
 assert.throws(()=>validateRun({prompt:'review architecture',agent_id:'research-agent',mode:'deploy',project_id:'tattoo-studio'},policy,tattoo));
 const run=validateRun({prompt:'review architecture',agent_id:'research-agent',project_id:'tattoo-studio'},policy,tattoo);
 assert.equal(run.project_id,'tattoo-studio');assert.equal(run.access_mode,'read_only_context');
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
