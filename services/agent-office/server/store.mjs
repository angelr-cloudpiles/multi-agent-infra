import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {randomUUID} from 'node:crypto';
import {normalizeEvent} from './domain.mjs';
import {scopeFor} from './projects.mjs';
export const db=DynamoDBDocumentClient.from(new DynamoDBClient({region:'us-east-1'}),{marshallOptions:{removeUndefinedValues:true}});
export const table=process.env.EVENT_TABLE;
export const scope=scopeFor('multi-agent');
export const pkFor=currentScope=>`PROJECT#${currentScope.project_id}#ENV#${currentScope.environment}`;
export const key=(currentScope,sk)=>({pk:pkFor(currentScope),sk});
export const definedPatch=patch=>Object.fromEntries(Object.entries(patch || {}).filter(([,value])=>value!==undefined));
export async function get(currentScope,sk){return (await db.send(new GetCommand({TableName:table,Key:key(currentScope,sk),ConsistentRead:true}))).Item;}
export async function put(currentScope,sk,item){await db.send(new PutCommand({TableName:table,Item:{...item,...key(currentScope,sk)},ConditionExpression:'attribute_not_exists(pk)'}));return item;}
export async function query(currentScope,prefix,limit=100,cursor){
 const data=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pkFor(currentScope),':prefix':prefix},ScanIndexForward:false,Limit:limit,ExclusiveStartKey:cursor}));
 return {items:data.Items || [],cursor:data.LastEvaluatedKey};
}
export async function updateRun(currentScope,run_id,patch,expected){
 const safePatch=definedPatch(patch),fields=Object.keys(safePatch),names={},values={};
 if(!fields.length)return;
 fields.forEach((k,i)=>{names['#k'+i]=k;values[':v'+i]=safePatch[k];});
 let condition='attribute_exists(pk)';
 if(expected){condition+=' AND #status = :expected';names['#status']='status';values[':expected']=expected;}
 await db.send(new UpdateCommand({TableName:table,Key:key(currentScope,'RUN#'+run_id),UpdateExpression:'SET '+fields.map((k,i)=>`#k${i}=:v${i}`).join(', '),ConditionExpression:condition,ExpressionAttributeNames:names,ExpressionAttributeValues:values}));
}
export async function chatMessage(currentScope,{role,content,agent_id='platform',run_id=null,parent_task_id=null,attachments=[],streaming=false}){
 if(!['user','agent','system'].includes(role))throw new Error('Invalid chat role');
 if(typeof content!=='string'||content.length>60000||(!content.trim()&&!attachments.length))throw new Error('Invalid chat content');
 const created_at=new Date().toISOString(),message_id=randomUUID();
 return put(currentScope,`CHAT#${created_at}#${message_id}`,{message_id,role,content:content.trim(),agent_id,run_id,parent_task_id,attachments,streaming,created_at});
}
export async function updateChatMessage(currentScope,message,{content,streaming=false,failed=false,trace_id,observation_id,feedback}){
 const patch={content:content.trim(),streaming,failed};
 if(trace_id)patch.trace_id=trace_id;
 if(observation_id)patch.observation_id=observation_id;
 if(feedback!==undefined)patch.feedback=feedback;
 const names={},values={};
 Object.entries(patch).forEach(([field,value],index)=>{names[`#f${index}`]=field;values[`:v${index}`]=value;});
 await db.send(new UpdateCommand({TableName:table,Key:key(currentScope,`CHAT#${message.created_at}#${message.message_id}`),UpdateExpression:'SET '+Object.keys(patch).map((_,index)=>`#f${index}=:v${index}`).join(', '),ExpressionAttributeNames:names,ExpressionAttributeValues:values}));
}
export async function event(input,currentScope=scope){
 const e=normalizeEvent(input,currentScope);
 const sk='EVENT#'+e.timestamp+'#'+e.event_id;
 try{await put(currentScope,sk,{...e,expires_at:Math.floor(Date.now()/1000)+90*86400});}catch(err){if(err.name!=='ConditionalCheckFailedException')throw err;}
 if(e.state && e.agent_id!=='platform'){
  try{await db.send(new PutCommand({TableName:table,Item:{...e,...key(currentScope,'AGENT#'+e.agent_id)},ConditionExpression:'attribute_not_exists(#ts) OR #ts <= :ts',ExpressionAttributeNames:{'#ts':'timestamp'},ExpressionAttributeValues:{':ts':e.timestamp}}));}catch(err){if(err.name!=='ConditionalCheckFailedException')throw err;}
 }
 return e;
}
