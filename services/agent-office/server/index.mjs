import express from 'express';import helmet from 'helmet';import crypto from 'node:crypto';import path from 'node:path';
import {authRoutes,requireAuth} from './auth.mjs';import {validateRun,mayApprove,publicError} from './domain.mjs';
import {query,put,get,event,updateRun,chatMessage} from './store.mjs';import {policy,enqueue,runConsumer} from './agents.mjs';import {collect,eventConsumer} from './collectors.mjs';
import {defaultProjectId,projectFor,publicProjects,scopeFor} from './projects.mjs';
const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],frameAncestors:["'none'"]}}}));app.use(express.json({limit:'24kb'}));
app.get('/healthz',(_,res)=>res.json({status:'ok'}));authRoutes(app);
function requestProject(req,res){try{return projectFor(req.query.project_id || defaultProjectId);}catch{return res.status(400).json({error:'Unknown project'}),null;}}
app.use('/api',requireAuth);
app.get('/api/me',(req,res)=>res.json({sub:req.user.sub,username:req.user.username,canApprove:(req.user['cognito:groups'] || []).includes('aiops-approvers')}));
app.get('/api/config',(_,res)=>res.json({agents:policy.agents,default_project_id:defaultProjectId,projects:publicProjects()}));
app.get('/api/snapshot',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);
 const [events,agents,runs]=await Promise.all([query(currentScope,'EVENT#',100),query(currentScope,'AGENT#',20),query(currentScope,'RUN#',100)]);
 res.json({project_id:project.project_id,environment:project.environment,events:events.items,agents:agents.items,runs:runs.items,observed_at:new Date().toISOString()});
});
app.get('/api/events',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const currentScope=scopeFor(project);let cursor;if(req.query.cursor){try{cursor=JSON.parse(Buffer.from(req.query.cursor,'base64url').toString());if(cursor.pk!==`PROJECT#${currentScope.project_id}#ENV#${currentScope.environment}`||!cursor.sk?.startsWith('EVENT#'))throw new Error();}catch{return res.status(400).json({error:'Invalid cursor'});}}
 const data=await query(currentScope,'EVENT#',100,cursor);res.json({events:data.items,cursor:data.cursor?Buffer.from(JSON.stringify(data.cursor)).toString('base64url'):null});
});
const rate=new Map();
async function queueRun(user,project,input){
 const currentScope=scopeFor(project);
 const now=Date.now();const recent=(rate.get(user.sub)||[]).filter(t=>t>now-3600000);
 if(recent.length>=10)throw Object.assign(new Error('Run limit reached. Try again later.'),{statusCode:429});
 const active=(await query(currentScope,'RUN#',100)).items.filter(r=>['queued','working'].includes(r.status));
 if(active.length>=2)throw Object.assign(new Error('Two runs are already active. Wait for completion.'),{statusCode:429});
 const run={...input,run_id:crypto.randomUUID(),requested_by:user.sub,status:'queued',created_at:new Date().toISOString()};
 await put(currentScope,'RUN#'+run.run_id,run);recent.push(now);rate.set(user.sub,recent);
 try{await enqueue(run);}catch(e){await updateRun(currentScope,run.run_id,{status:'error',error_code:'QueueSubmissionFailed'});throw e;}
 await event({source:'office',type:'run.queued',agent_id:run.agent_id,run_id:run.run_id,state:'queued'},currentScope);return run;
}
app.post('/api/runs',async(req,res)=>{
 let project,input;try{project=projectFor(req.body?.project_id || defaultProjectId);input=validateRun(req.body,policy,project);const run=await queueRun(req.user,project,input);res.status(202).json({run_id:run.run_id,project_id:project.project_id});}catch(e){return res.status(e.statusCode||400).json({error:e.message});}
});
app.get('/api/chat',async(req,res)=>{
 const project=requestProject(req,res);if(!project)return;const data=await query(scopeFor(project),'CHAT#',100);res.json({messages:data.items.reverse()});
});
app.post('/api/chat',async(req,res)=>{
 const body=req.body||{};let project,input;try{
  if(Object.keys(body).some(key=>!['message','agent_id','project_id'].includes(key)))throw new Error('Unsupported request field');
  project=projectFor(body.project_id||defaultProjectId);
  input=validateRun({prompt:body.message,agent_id:body.agent_id,project_id:project.project_id},policy,project);
  const run=await queueRun(req.user,project,input),currentScope=scopeFor(project);
  await chatMessage(currentScope,{role:'user',content:input.prompt,agent_id:input.agent_id,run_id:run.run_id});
  await chatMessage(currentScope,{role:'system',content:`Pedido enviado a ${input.agent_id}.`,agent_id:input.agent_id,run_id:run.run_id});
  res.status(202).json({run_id:run.run_id,project_id:project.project_id});
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
