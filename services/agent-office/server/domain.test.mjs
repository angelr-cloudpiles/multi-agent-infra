import test from 'node:test';import assert from 'node:assert/strict';
import {agentMemoryIdentity,validateRun,normalizeEvent,mayApprove,mayAssist,validateAssistance,ASSISTABLE_STATUSES,agentFailureGuidance,canRetrySynthesis} from './domain.mjs';
import {projectFor} from './projects.mjs';
import {executionPlan} from './workflow.mjs';
import {policy} from './policy.mjs';
test('untrusted callers cannot inject model endpoints, skills or limits',()=>{
 const platform=projectFor('multi-agent');
 for(const field of ['model','skills','maxTokens','environment','tools'])assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',[field]:{}},policy,platform));
 assert.throws(()=>validateRun({prompt:'hello',agent_id:'code-agent',alias:'bedrock-claude-opus-5'},policy,platform));
 assert.equal(validateRun({prompt:'hello',agent_id:'review-agent',alias:'bedrock-claude-opus-5'},policy,platform).alias,'bedrock-claude-opus-5');
});
test('project policy scopes runs before they enter the queue',()=>{
 const tattoo=projectFor('tattoo-studio');
 assert.throws(()=>validateRun({prompt:'review architecture',agent_id:'deploy-agent',project_id:'tattoo-studio'},policy,tattoo));
 assert.throws(()=>validateRun({prompt:'review architecture',agent_id:'research-agent',mode:'deploy',project_id:'tattoo-studio'},policy,tattoo));
 const run=validateRun({prompt:'review architecture',agent_id:'research-agent',project_id:'tattoo-studio'},policy,tattoo);
 assert.equal(run.project_id,'tattoo-studio');assert.equal(run.access_mode,'read_only_context');
 const uiRun=validateRun({prompt:'define the navigation states',agent_id:'ui-design-agent',project_id:'tattoo-studio'},policy,tattoo);
 assert.equal(uiRun.agent_id,'ui-design-agent');
});
test('orchestration only delegates to agents enabled for the project',()=>{
 const tattoo=projectFor('tattoo-studio');
 const plan=executionPlan({agent_id:'orchestrator-agent',mode:'task'},tattoo);
 assert.deepEqual(plan.parallel,['research-agent','review-agent','ui-design-agent']);
 assert.equal(plan.synthesizer,'orchestrator-agent');
 assert.equal(plan.parallel.includes('code-agent'),false);
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
test('memory identity isolates a project and does not expose the Cognito subject',()=>{
 const identity=agentMemoryIdentity('tattoo-studio','code-agent','cognito-subject-123');
 assert.match(identity.actorId,/^project-tattoo-studio-user-[a-f0-9]{24}$/);
 assert.equal(identity.actorId.includes('cognito-subject-123'),false);
  assert.match(identity.sessionId,/^agent-office-runtime-tattoo-studio-code-agent-[a-f0-9]{24}-[a-f0-9]{16}$/);
  assert.match(identity.conversationId,/^agent-office-conversation-tattoo-studio-[a-f0-9]{24}$/);
 assert.notDeepEqual(identity,agentMemoryIdentity('multi-agent','code-agent','cognito-subject-123'));
 assert.notDeepEqual(identity,agentMemoryIdentity('tattoo-studio','review-agent','cognito-subject-123'));
});

test('task requester can assist a paused or failed run without gaining approval rights',()=>{
 const owner={sub:'owner','cognito:groups':['us-east-1_HfqTm2uYI']};
 const other={sub:'other','cognito:groups':[]};
 const run={requested_by:'owner'};
 assert.equal(mayAssist(owner,run),true);
 assert.equal(mayAssist(other,run),true);
 assert.equal(mayAssist({},run),false);
 assert.equal(ASSISTABLE_STATUSES.has('error'),true);
 assert.deepEqual(validateAssistance({message:'Use the approved repository revision.',attachments:['attachment-1']}),{message:'Use the approved repository revision.',attachment_ids:['attachment-1']});
 assert.deepEqual(validateAssistance({message:'',attachments:['attachment-1']}),{message:'Review the attached assistance material.',attachment_ids:['attachment-1']});
 assert.throws(()=>validateAssistance({message:'no'}));
 assert.throws(()=>validateAssistance({message:'valid assistance',agent_id:'code-agent'}));
});


test('agent failure guidance keeps partial work actionable',()=>{
 const message=agentFailureGuidance('RuntimeClientError',['research-agent','review-agent']);
 assert.match(message,/AgentCore interrumpió/);
 assert.match(message,/research-agent, review-agent/);
 assert.match(message,/reintentar solo la síntesis/);
 assert.equal(canRetrySynthesis({status:'error',agent_id:'orchestrator-agent'}),true);
 assert.equal(canRetrySynthesis({status:'completed',agent_id:'orchestrator-agent'}),false);
 assert.equal(canRetrySynthesis({status:'error',agent_id:'research-agent'}),false);
});


test('conversation continuations stay within their existing task',()=>{
 const tattoo=projectFor('tattoo-studio');
 const plan=executionPlan({agent_id:'orchestrator-agent',mode:'task',continuation_kind:'conversation_message'},tattoo);
 assert.deepEqual(plan,{parallel:['orchestrator-agent'],synthesizer:null});
});
