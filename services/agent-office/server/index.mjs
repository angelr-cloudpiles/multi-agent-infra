import express from 'express';import helmet from 'helmet';import crypto from 'node:crypto';import path from 'node:path';
import {authRoutes,requireAuth} from './auth.mjs';import {validateRun,mayApprove,publicError} from './domain.mjs';
import {query,put,get,event,updateRun} from './store.mjs';import {policy,enqueue,runConsumer} from './agents.mjs';import {collect,eventConsumer} from './collectors.mjs';
const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:'],connectSrc:["'self'"],frameAncestors:["'none'"]}}}));app.use(express.json({limit:'24kb'}));
app.get('/healthz',(_,res)=>res.json({status:'ok'}));authRoutes(app);
app.get('/api/config',(_,res)=>res.json({agents:policy.agents,project_id:'multi-agent',environment:'production'}));
app.use('/api',requireAuth);
app.get('/api/me',(req,res)=>res.json({sub:req.user.sub,username:req.user.username,canApprove:(req.user['cognito:groups'] || []).includes('aiops-approvers')}));
app.get('/api/snapshot',async(_,res)=>{
 const [events,agents,runs]=await Promise.all([query('EVENT#',100),query('AGENT#',20),query('RUN#',100)]);
 res.json({events:events.items,agents:agents.items,runs:runs.items,observed_at:new Date().toISOString()});
});
app.get('/api/events',async(req,res)=>{
 let cursor;if(req.query.cursor){try{cursor=JSON.parse(Buffer.from(req.query.cursor,'base64url').toString());if(cursor.pk!=='PROJECT#multi-agent#ENV#production'||!cursor.sk?.startsWith('EVENT#'))throw new Error();}catch{return res.status(400).json({error:'Invalid cursor'});}}
 const data=await query('EVENT#',100,cursor);res.json({events:data.items,cursor:data.cursor?Buffer.from(JSON.stringify(data.cursor)).toString('base64url'):null});
});
const rate=new Map();
app.post('/api/runs',async(req,res)=>{
 let input;try{input=validateRun(req.body,policy);}catch(e){return res.status(400).json({error:e.message});}
 const now=Date.now();const recent=(rate.get(req.user.sub)||[]).filter(t=>t>now-3600000);
 if(recent.length>=10)return res.status(429).json({error:'Run limit reached. Try again later.'});
 const active=(await query('RUN#',100)).items.filter(r=>['queued','working'].includes(r.status));
 if(active.length>=2)return res.status(429).json({error:'Two runs are already active. Wait for completion.'});
 const run={...input,run_id:crypto.randomUUID(),requested_by:req.user.sub,status:'queued',created_at:new Date().toISOString()};
 await put('RUN#'+run.run_id,run);recent.push(now);rate.set(req.user.sub,recent);
 try{await enqueue(run.run_id);}catch(e){await updateRun(run.run_id,{status:'error',error_code:'QueueSubmissionFailed'});throw e;}
 await event({source:'office',type:'run.queued',agent_id:run.agent_id,run_id:run.run_id,state:'queued'});res.status(202).json({run_id:run.run_id});
});
app.post('/api/runs/:id/approval',async(req,res)=>{
 const run=await get('RUN#'+req.params.id);if(!run)return res.sendStatus(404);
 if(!mayApprove(req.user,run))return res.status(403).json({error:'An independent member of aiops-approvers must review this plan.'});
 if(!['approve','reject'].includes(req.body.decision))return res.sendStatus(400);
 await updateRun(run.run_id,{status:req.body.decision==='approve'?'approved':'rejected',reviewed_by:req.user.sub,reviewed_at:new Date().toISOString()},'waiting_for_approval');
 await event({source:'office',type:'approval.'+req.body.decision,run_id:run.run_id,agent_id:run.agent_id,state:req.body.decision==='approve'?'idle':'paused',actor_id:req.user.sub});
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
