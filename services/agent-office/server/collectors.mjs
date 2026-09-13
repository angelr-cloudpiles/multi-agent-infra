import {ECSClient,DescribeServicesCommand} from '@aws-sdk/client-ecs';
import {BedrockAgentCoreControlClient,GetHarnessCommand} from '@aws-sdk/client-bedrock-agentcore-control';
import {ReceiveMessageCommand,DeleteMessageCommand} from '@aws-sdk/client-sqs';
import {event} from './store.mjs';import {harnesses,sqs,langfuse} from './agents.mjs';
const ecs=new ECSClient({region:'us-east-1'}),control=new BedrockAgentCoreControlClient({region:'us-east-1'});
const known=new Map();
async function changed(id,value,input){const digest=JSON.stringify(value);if(known.get(id)!==digest){await event({...input,detail:value});known.set(id,digest);}}
export async function collect(){
 const services=await ecs.send(new DescribeServicesCommand({cluster:'multi-agent-platform',services:['multi-agent-clickhouse','multi-agent-litellm','multi-agent-langfuse','multi-agent-langfuse-worker','multi-agent-agent-office']}));
 for(const s of services.services || [])await changed(s.serviceName,{running:s.runningCount,desired:s.desiredCount,deployment:s.deployments?.[0]?.rolloutState},{source:'ecs',type:'service.observed',service:s.serviceName});
 for(const [agent_id,h] of Object.entries(harnesses)){
  const result=await control.send(new GetHarnessCommand({harnessId:h.harnessId}));
  await changed(agent_id,result.harness?.status,{source:'agentcore',type:'harness.observed',agent_id});
 }
 const response=await fetch('https://litellm.aiops.cloudpiles.net/health/liveliness',{signal:AbortSignal.timeout(10000)});
 await changed('litellm-health',{http_status:response.status},{source:'litellm',type:'proxy.observed'});
 const traces=await langfuse('/traces?limit=50');
 for(const t of traces.data || []){
  await changed('trace-'+t.id,{trace_id:t.id,cost_usd:t.totalCost ?? null,observations:t.observations?.length ?? null},{source:'langfuse',type:'trace.observed',event_id:'langfuse-'+t.id,timestamp:t.timestamp,run_id:t.metadata?.run_id || t.id,agent_id:t.metadata?.agent_id || 'platform',trace_id:t.id});
 }
}
export async function eventConsumer(signal){
 while(!signal.aborted){
  try{
   const response=await sqs.send(new ReceiveMessageCommand({QueueUrl:process.env.EVENT_QUEUE_URL,WaitTimeSeconds:20,MaxNumberOfMessages:10}),{abortSignal:signal});
   for(const m of response.Messages || []){
    const raw=JSON.parse(m.Body);
    if(raw.account==='278741241787' && ['aws.ecs','cloudpiles.cicd'].includes(raw.source)){
     const d=raw.detail || {};
     await event({source:raw.source==='aws.ecs'?'ecs':'cicd',type:raw['detail-type'] || 'external.event',event_id:raw.id,timestamp:raw.time,run_id:d.run_id || d.taskArn?.split('/').pop() || 'system',detail:{status:d.status || d.lastStatus,service:d.group,workflow:d.workflow,commit:d.commit,url:d.url}});
    }
    await sqs.send(new DeleteMessageCommand({QueueUrl:process.env.EVENT_QUEUE_URL,ReceiptHandle:m.ReceiptHandle}));
   }
  }catch(e){if(!signal.aborted){console.error(JSON.stringify({component:'event-consumer',error_code:e.name}));await new Promise(r=>setTimeout(r,5000));}}
 }
}
