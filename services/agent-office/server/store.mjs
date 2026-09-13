import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {normalizeEvent} from './domain.mjs';
import {scopeFor} from './projects.mjs';
export const db=DynamoDBDocumentClient.from(new DynamoDBClient({region:'us-east-1'}),{marshallOptions:{removeUndefinedValues:true}});
export const table=process.env.EVENT_TABLE;
export const scope=scopeFor('multi-agent');
export const pkFor=currentScope=>`PROJECT#${currentScope.project_id}#ENV#${currentScope.environment}`;
export const key=(currentScope,sk)=>({pk:pkFor(currentScope),sk});
export async function get(currentScope,sk){return (await db.send(new GetCommand({TableName:table,Key:key(currentScope,sk),ConsistentRead:true}))).Item;}
export async function put(currentScope,sk,item){await db.send(new PutCommand({TableName:table,Item:{...item,...key(currentScope,sk)},ConditionExpression:'attribute_not_exists(pk)'}));return item;}
export async function query(currentScope,prefix,limit=100,cursor){
 const data=await db.send(new QueryCommand({TableName:table,KeyConditionExpression:'pk=:pk AND begins_with(sk,:prefix)',ExpressionAttributeValues:{':pk':pkFor(currentScope),':prefix':prefix},ScanIndexForward:false,Limit:limit,ExclusiveStartKey:cursor}));
 return {items:data.Items || [],cursor:data.LastEvaluatedKey};
}
export async function updateRun(currentScope,run_id,patch,expected){
 const fields=Object.keys(patch),names={},values={};
 fields.forEach((k,i)=>{names['#k'+i]=k;values[':v'+i]=patch[k];});
 let condition='attribute_exists(pk)';
 if(expected){condition+=' AND #status = :expected';names['#status']='status';values[':expected']=expected;}
 await db.send(new UpdateCommand({TableName:table,Key:key(currentScope,'RUN#'+run_id),UpdateExpression:'SET '+fields.map((k,i)=>`#k${i}=:v${i}`).join(', '),ConditionExpression:condition,ExpressionAttributeNames:names,ExpressionAttributeValues:values}));
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
