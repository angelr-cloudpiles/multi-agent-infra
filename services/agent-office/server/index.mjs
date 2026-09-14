import express from 'express';import helmet from 'helmet';import crypto from 'node:crypto';import path from 'node:path';import {GetObjectCommand,PutObjectCommand,S3Client} from '@aws-sdk/client-s3';
import {authRoutes,requireAuth} from './auth.mjs';import {ASSISTABLE_STATUSES,validateRun,mayApprove,mayAssist,validateAssistance,canRetrySynthesis,publicError} from './domain.mjs';
import {query,put,get,event,updateRun,chatMessage,updateChatMessage} from './store.mjs';import {policy,enqueue,projectControl,recordUserFeedback,runConsumer} from './agents.mjs';import {collect,eventConsumer} from './collectors.mjs';
import {defaultProjectId,projectFor,publicProjects,scopeFor} from './projects.mjs';
const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],frameAncestors:["'none'"]}}}));app.use(express.json({limit:'24kb'}));
const storage=new S3Client({region:'us-east-1'}),attachmentLimit=25*1024*1024;
app.get('/healthz',(_,res)=>res.json({status:'ok'}));authRoutes(app);
function requestProject(req,res){try{return projectFor(req.query.project_id || defaultProjectId);}catch{return res.status(400).json({error:'Unknown project'}),null;}}
function visibleRun(run){return run.requested_by!=='agent-office-validation'&&!run.continuation_kind;}
app.use('/api',requireAuth);
app.get('/api/me',(req,res)=>res.json({sub:req.user.sub,username:req.user.username,canApprove:(req.user['cognito:groups'] || []).includes('aiops-approvers')}));
app.get('/api/config',(_,res)=>res.json({agents:policy.agents,default_project_id:defaultProjectId,projects:publicProjects()}));
app.get('/api/projects/:projectId/control',async(req,res)=>{
 try{res.json(await projectControl(req.params.projectId));}catch(error){res.status(error.name==='UnknownProjectError'?404:502).json({error:'Project control state is unavailable'});}
});
app.get('/api/agents/activity',async(_,res)=>{
 const agentIds=Object.keys(policy.agents),projects=publicProjects();
 const scoped=await Promise.all(projects.map(async project=>{const currentScope=scopeFor(project);const [runs,events]=await Promise.all([query(currentScope,'RUN#',100),query(currentScope,'EVENT#',100)]);const activeRuns=runs.items.filter(run=>run.requested_by!=='agent-office-validation'),hiddenRunIds=new Set(runs.items.filter(run=>run.requested_by==='agent-office-validation').map(run=>run.run_id));return {project,runs:activeRuns,events:events.items.filter(item=>!hiddenRunIds.has(item.run_id))};}));
 const agents=Object.fromEntries(agentIds.map(agent_id=>{
  const entries=scoped.flatMap(({project,runs,events})=>{const run=runs.find(item=>item.agent_id===agent_id&&['queued','working','waiting_for_approval','paused','error'].includes(item.status));const root=run&&(runs.find(item=>item.run_id===(run.parent_task_id||run.parent_run_id))||run);const event=events.find(item=>item.agent_id===agent_id);return run||event?{project_id:project.project_id,project_name:project.display_name,run,root,event}:null;}).filter(Boolean);
  const active=entries.filter(entry=>entry.run).sort((a,b)=>String(b.run.created_at).localeCompare(String(a.run.created_at)))[0];
  const latest=entries.sort((a,b)=>String(b.event?.timestamp||b.run?.created_at).localeCompare(String(a.event?.timestamp||a.run?.created_at)))[0];
  // Historical events describe prior work; only a persisted non-terminal run may place an agent in an attention state.
  const state=active?.run.status || 'idle';
  return [agent_id,{state,active_run_id:active?.run?.run_id||null,active_task_id:active?.root?.run_id||null,active_project_id:active?.project_id||latest?.project_id||null,active_project_name:active?.project_name||latest?.project_name||null,task:active?.root?.prompt||active?.run?.prompt||null,event:latest?.event?.type||null,projects:entries.map(entry=>({project_id:entry.project_id,project_name:entry.project_name,state:entry.run?.status||'idle',task:entry.root?.prompt||entry.run?.prompt||null}))}];
 }));
 res.json({agents});
});
app.get('/api/snapshot',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);
 const [events,agents,runs]=await Promise.all([query(currentScope,'EVENT#',100),query(currentScope,'AGENT#',20),query(currentScope,'RUN#',100)]);const visibleRuns=runs.items.filter(visibleRun),hiddenRunIds=new Set(runs.items.filter(run=>!visibleRun(run)).map(run=>run.run_id));
 res.json({project_id:project.project_id,environment:project.environment,events:events.items.filter(item=>!hiddenRunIds.has(item.run_id)),agents:agents.items,runs:visibleRuns,observed_at:new Date().toISOString()});
});
app.get('/api/events',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);let cursor;if(req.query.cursor){try{cursor=JSON.parse(Buffer.from(req.query.cursor,'base64url').toString());if(cursor.pk!==`PROJECT#${currentScope.project_id}#ENV#${currentScope.environment}`||!cursor.sk?.startsWith('EVENT#'))throw new Error();}catch{return res.status(400).json({error:'Invalid cursor'});}}
 const data=await query(currentScope,'EVENT#',100,cursor);res.json({events:data.items,cursor:data.cursor?Buffer.from(JSON.stringify(data.cursor)).toString('base64url'):null});
});
const rate=new Map();
async function preservedResults(currentScope,parent){
 if(Array.isArray(parent.results)&&parent.results.length)return parent.results;
 const history=(await query(currentScope,'CHAT#',100)).items;
 const byAgent=new Map();
 for(const message of history){
  if(message.run_id===parent.run_id&&message.role==='agent'&&!message.failed&&!message.streaming&&message.content&&message.content!=='Redactando…'&&!byAgent.has(message.agent_id))byAgent.set(message.agent_id,{agent_id:message.agent_id,output:message.content,trace_id:message.trace_id,observation_id:message.observation_id});
 }
 return [...byAgent.values()];
}
async function queueRun(user,project,input,metadata={}){
 const currentScope=scopeFor(project);
 const now=Date.now();const recent=(rate.get(user.sub)||[]).filter(t=>t>now-3600000);
 if(recent.length>=10)throw Object.assign(new Error('Run limit reached. Try again later.'),{statusCode:429});
 const active=(await query(currentScope,'RUN#',100)).items.filter(r=>['queued','working'].includes(r.status));
 if(active.length>=2)throw Object.assign(new Error('Two runs are already active. Wait for completion.'),{statusCode:429});
 const run={...input,...metadata,run_id:crypto.randomUUID(),requested_by:user.sub,status:'queued',created_at:new Date().toISOString(),context_revision:project.context_source?.revision};
 await put(currentScope,'RUN#'+run.run_id,run);recent.push(now);rate.set(user.sub,recent);
 try{await enqueue(run);}catch(e){await updateRun(currentScope,run.run_id,{status:'error',error_code:'QueueSubmissionFailed'});throw e;}
 await event({source:'office',type:'run.queued',agent_id:run.agent_id,run_id:run.run_id,state:'queued'},currentScope);return run;
}
app.post('/api/runs',async(req,res)=>{
 let project,input;try{project=projectFor(req.body?.project_id || defaultProjectId);input=validateRun(req.body,policy,project);const run=await queueRun(req.user,project,input);res.status(202).json({run_id:run.run_id,project_id:project.project_id});}catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
async function taskMessageContext(currentScope){
 const runs=(await query(currentScope,'RUN#',250)).items,byRunId=new Map(runs.map(run=>[run.run_id,run]));
 const taskFor=runId=>{const run=byRunId.get(runId);return run?.parent_task_id||run?.parent_run_id||run?.run_id||runId||null;};
 return {byRunId,annotate:item=>({...item,task_id:item.parent_task_id||taskFor(item.run_id)})};
}
app.get('/api/chat',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);const [chat,context]=await Promise.all([query(currentScope,'CHAT#',100),taskMessageContext(currentScope)]);res.json({messages:chat.items.reverse().map(context.annotate)});
});
app.get('/api/tasks/:id/chat',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);const root=await get(currentScope,'RUN#'+req.params.id);if(!root||root.continuation_kind)return res.sendStatus(404);
 const context=await taskMessageContext(currentScope);let cursor,items=[],pages=0;
 do { const page=await query(currentScope,'CHAT#',100,cursor);items.push(...page.items.map(context.annotate).filter(item=>item.task_id===root.run_id));cursor=page.cursor;pages+=1; } while(cursor&&pages<20);
 res.json({task_id:root.run_id,messages:items.sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))),truncated:Boolean(cursor)});
});
app.put('/api/uploads',express.raw({type:'*/*',limit:'25mb'}),async(req,res)=>{
 try{
  const project=requestProject(req,res);if(!project)return;const bytes=req.body;
  const name=decodeURIComponent(req.get('x-file-name') || '').replace(/[\\/\0]/g,'_').trim();const contentType=(req.get('content-type') || 'application/octet-stream').slice(0,200);
  if(!name||!bytes?.length||bytes.length>attachmentLimit)throw new Error('File must be between 1 byte and 25 MB');
  const attachment_id=crypto.randomUUID(),key=`agent-office/${project.project_id}/attachments/${attachment_id}/${name}`,attachment={attachment_id,name,content_type:contentType,size:bytes.length,s3_uri:`s3://${process.env.ATTACHMENTS_BUCKET}/${key}`,key,created_at:new Date().toISOString()};
  await storage.send(new PutObjectCommand({Bucket:process.env.ATTACHMENTS_BUCKET,Key:key,Body:bytes,ContentType:contentType,ServerSideEncryption:'aws:kms'}));
  await put(scopeFor(project),'ATTACHMENT#'+attachment_id,attachment);res.status(201).json({attachment});
 }catch(error){res.status(error.name==='EntityTooLarge'?413:400).json({error:error.message || 'File upload failed'});}
});
app.get('/api/attachments/:id',async(req,res)=>{
 try{
  const project=requestProject(req,res);if(!project)return;const attachment=await get(scopeFor(project),'ATTACHMENT#'+req.params.id);if(!attachment)return res.sendStatus(404);
  const file=await storage.send(new GetObjectCommand({Bucket:process.env.ATTACHMENTS_BUCKET,Key:attachment.key}));res.type(file.ContentType || 'application/octet-stream');res.setHeader('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`);file.Body.pipe(res);
 }catch{res.sendStatus(404);}
});
app.post('/api/chat',async(req,res)=>{
 const body=req.body||{};let project,input;try{
  if(Object.keys(body).some(key=>!['message','agent_id','project_id','attachments'].includes(key)))throw new Error('Unsupported request field');
  project=projectFor(body.project_id||defaultProjectId);
  const ids=Array.isArray(body.attachments)?body.attachments:[];if(ids.length>10||ids.some(id=>typeof id!=='string'))throw new Error('Invalid attachments');
  const attachments=await Promise.all(ids.map(async attachment_id=>{const attachment=await get(scopeFor(project),'ATTACHMENT#'+attachment_id);if(!attachment)throw new Error('Unknown attachment');return attachment;}));
  input=validateRun({prompt:typeof body.message==='string'&&body.message.trim()?body.message:'Analiza los archivos adjuntos.',agent_id:body.agent_id,project_id:project.project_id,attachments},policy,project);
  const run=await queueRun(req.user,project,input),currentScope=scopeFor(project);
  await chatMessage(currentScope,{role:'user',content:input.prompt,agent_id:input.agent_id,run_id:run.run_id,attachments});
  await chatMessage(currentScope,{role:'system',content:`Pedido enviado a ${input.agent_id}.`,agent_id:input.agent_id,run_id:run.run_id});
  res.status(202).json({run_id:run.run_id,task_id:run.run_id,project_id:project.project_id});
 }catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
app.post('/api/tasks/:id/messages',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);
 try{
  const parent=await get(currentScope,'RUN#'+req.params.id);if(!parent||parent.continuation_kind)return res.sendStatus(404);
  if(parent.status==='waiting_for_approval')return res.status(409).json({error:'Esta tarea está esperando aprobación; aprobala o rechazala antes de continuar.'});
  const body=req.body||{};if(Object.keys(body).some(key=>!['message','attachments'].includes(key)))throw new Error('Unsupported request field');
  const ids=Array.isArray(body.attachments)?body.attachments:[];if(ids.length>10||ids.some(id=>typeof id!=='string'))throw new Error('Invalid attachments');
  const attachments=await Promise.all(ids.map(async attachment_id=>{const attachment=await get(currentScope,'ATTACHMENT#'+attachment_id);if(!attachment)throw new Error('Unknown attachment');return attachment;}));
  const message=typeof body.message==='string'&&body.message.trim()?body.message:'Analiza los archivos adjuntos.';
  const prompt=[`Continue the existing task ${parent.run_id} for ${project.display_name}.`,`Original task: ${String(parent.prompt).slice(0,7000)}`,`User message: ${message}`,'Respond directly to this message, update the task with concrete next steps, and ask one focused question only if a decision is truly required.'].join('\n\n');
  const input=validateRun({prompt,agent_id:parent.agent_id,alias:parent.alias,mode:parent.mode,project_id:project.project_id,attachments},policy,project);
  const run=await queueRun(req.user,project,input,{parent_task_id:parent.run_id,continuation_kind:'conversation_message'});
  await updateRun(currentScope,parent.run_id,{status:'working',last_interacted_at:new Date().toISOString(),active_continuation_run_id:run.run_id});
  await chatMessage(currentScope,{role:'user',content:message,agent_id:parent.agent_id,run_id:run.run_id,parent_task_id:parent.run_id,attachments});
  await chatMessage(currentScope,{role:'system',content:`Seguimiento de la tarea ${parent.run_id.slice(0,8)} enviado a ${parent.agent_id}.`,agent_id:parent.agent_id,run_id:run.run_id,parent_task_id:parent.run_id});
  await event({source:'office',type:'task.message_queued',agent_id:parent.agent_id,run_id:run.run_id,state:'queued',parent_run_id:parent.run_id},currentScope);
  res.status(202).json({run_id:run.run_id,task_id:parent.run_id,project_id:project.project_id});
 }catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
app.post('/api/chat/:messageId/feedback',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;
 try{
  const positive=req.body?.positive;
  if(typeof positive!=='boolean')throw new Error('Feedback must be positive or negative');
  const messages=(await query(scopeFor(project),'CHAT#',100)).items;
  const item=messages.find(message=>message.message_id===req.params.messageId);
  if(!item||item.role!=='agent'||item.streaming||!item.trace_id)return res.sendStatus(404);
  if(item.feedback!==undefined)return res.status(409).json({error:'Feedback already recorded'});
  await recordUserFeedback(project.project_id,item.trace_id,positive);
  await updateChatMessage(scopeFor(project),item,{content:item.content,streaming:false,failed:Boolean(item.failed),trace_id:item.trace_id,observation_id:item.observation_id,feedback:positive});
  res.status(201).json({recorded:true});
 }catch(error){res.status(400).json(publicError(error));}
});
app.post('/api/runs/:id/retry-synthesis',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);
 try{
  const parent=await get(currentScope,'RUN#'+req.params.id);if(!parent)return res.sendStatus(404);
  if(!mayAssist(req.user)||!canRetrySynthesis(parent))return res.status(409).json({error:'Solo se puede reintentar la síntesis de una coordinación pausada o con error.'});
  const results=await preservedResults(currentScope,parent);if(!results.length)return res.status(409).json({error:'No hay resultados de especialistas para sintetizar.'});
  await updateRun(currentScope,parent.run_id,{results,recovery_requested_at:new Date().toISOString(),recovery_requested_by:req.user.sub});
  const input=validateRun({prompt:`Retoma la síntesis de la tarea ${parent.run_id} sin repetir el trabajo de los especialistas.`,agent_id:'orchestrator-agent',alias:parent.alias,mode:parent.mode,project_id:project.project_id},policy,project);
  const run=await queueRun(req.user,project,input,{parent_run_id:parent.run_id,continuation_kind:'synthesize_existing'});
  await chatMessage(currentScope,{role:'system',content:`Reintentando solo la síntesis con ${results.length} resultados preservados.`,agent_id:'orchestrator-agent',run_id:run.run_id,parent_task_id:parent.run_id});
  await event({source:'office',type:'run.synthesis_retry_queued',agent_id:'orchestrator-agent',run_id:run.run_id,state:'queued',parent_run_id:parent.run_id},currentScope);
  res.status(202).json({run_id:run.run_id,task_id:parent.run_id,project_id:project.project_id});
 }catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
app.post('/api/runs/:id/assist',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);
 try{
  const parent=await get(currentScope,'RUN#'+req.params.id);if(!parent)return res.sendStatus(404);
  if(!ASSISTABLE_STATUSES.has(parent.status))return res.status(409).json({error:'This task does not require assistance.'});
  if(!mayAssist(req.user))return res.status(403).json({error:'An authenticated workspace user is required to assist this task.'});
  const assistance=validateAssistance(req.body||{});
  const attachments=await Promise.all(assistance.attachment_ids.map(async attachment_id=>{const attachment=await get(currentScope,'ATTACHMENT#'+attachment_id);if(!attachment)throw new Error('Unknown attachment');return attachment;}));
  const continuationPrompt=[
   `Continue task ${parent.run_id} for ${project.display_name}.`,
   `Original request: ${String(parent.prompt).slice(0,7000)}`,
   `Prior status: ${parent.status}${parent.error_code?` (${parent.error_code})`:''}.`,
   `User assistance: ${assistance.message}`,
   'Use this assistance to continue the work. State any remaining blocker explicitly and do not repeat the original request verbatim.'
  ].join('\n\n');
  const input=validateRun({prompt:continuationPrompt,agent_id:parent.agent_id,alias:parent.alias,mode:parent.mode,project_id:project.project_id,attachments},policy,project);
  const run=await queueRun(req.user,project,input,{parent_run_id:parent.run_id,continuation_kind:'user_assistance'});
  await updateRun(currentScope,parent.run_id,{status:'assisted',assisted_by:req.user.sub,assisted_at:new Date().toISOString(),continuation_run_id:run.run_id},parent.status);
  await chatMessage(currentScope,{role:'user',content:assistance.message,agent_id:parent.agent_id,run_id:run.run_id,parent_task_id:parent.run_id,attachments});
  await chatMessage(currentScope,{role:'system',content:`Asistencia enviada a ${parent.agent_id}; continuación ${run.run_id.slice(0,8)} encolada.`,agent_id:parent.agent_id,run_id:run.run_id,parent_task_id:parent.run_id});
  await event({source:'office',type:'run.assistance_submitted',agent_id:parent.agent_id,run_id:run.run_id,state:'queued',parent_run_id:parent.run_id},currentScope);
  res.status(202).json({run_id:run.run_id,parent_run_id:parent.run_id,project_id:project.project_id});
 }catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
app.post('/api/runs/:id/approval',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);const run=await get(currentScope,'RUN#'+req.params.id);if(!run)return res.sendStatus(404);
 if(!mayApprove(req.user,run))return res.status(403).json({error:'An independent member of aiops-approvers must review this plan.'});
 if(!['approve','reject'].includes(req.body.decision))return res.sendStatus(400);
 await updateRun(currentScope,run.run_id,{status:req.body.decision==='approve'?'approved':'rejected',reviewed_by:req.user.sub,reviewed_at:new Date().toISOString()},'waiting_for_approval');
 await event({source:'office',type:'approval.'+req.body.decision,run_id:run.run_id,agent_id:run.agent_id,state:req.body.decision==='approve'?'idle':'paused',actor_id:req.user.sub},currentScope);
 res.json({status:req.body.decision,production_workflow:'https://github.com/angelr-cloudpiles/multi-agent-infra/actions/workflows/deploy.yml',message:'La aprobación del plan queda registrada. Producción requiere además la aprobación del entorno GitHub.'});
});
app.use(express.static(path.resolve('dist')));app.get('/{*path}',(_,res)=>res.sendFile(path.resolve('dist/index.html')));
app.use((err,req,res,next)=>{console.error(JSON.stringify({error_code:err.name,path:req.path}));res.status(err.name==='ConditionalCheckFailedException'?409:500).json(publicError(err));});
const server=app.listen(process.env.PORT || 8080,'0.0.0.0');const stop=new AbortController();
if(process.env.EVENT_TABLE){
 runConsumer(stop.signal);eventConsumer(stop.signal);
 let collecting=false;
 const poll=async()=>{if(collecting)return;collecting=true;try{await collect();}catch(e){console.error(JSON.stringify({component:'collector',error_code:e.name}));}finally{collecting=false;}};
 poll();const timer=setInterval(poll,30000);timer.unref();
}
process.on('SIGTERM',()=>{stop.abort();server.close();setTimeout(()=>process.exit(0),55000).unref();});
