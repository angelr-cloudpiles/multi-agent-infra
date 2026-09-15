import crypto from 'node:crypto';
import {CognitoJwtVerifier} from 'aws-jwt-verify';
const pool='us-east-1_HfqTm2uYI',client='1ebc3vlsnt8raekoipr3fplim0';
const domain='https://aiops-multi-agent-278741241787.auth.us-east-1.amazoncognito.com';
const origin=process.env.PUBLIC_URL || 'https://aiops.cloudpiles.net';
const accessClientIds=(process.env.COGNITO_APP_CLIENT_IDS || client).split(',').map(value=>value.trim()).filter(Boolean);
const access=CognitoJwtVerifier.create({userPoolId:pool,tokenUse:'access',clientId:accessClientIds});
const identity=CognitoJwtVerifier.create({userPoolId:pool,tokenUse:'id',clientId:client});
const cookieOpts={httpOnly:true,secure:true,sameSite:'lax',path:'/'};
const refreshCookieOpts={...cookieOpts,maxAge:30*24*60*60*1000};
function cookies(req){return Object.fromEntries((req.headers.cookie || '').split(';').map(x=>x.trim().split(/=(.*)/s)).filter(x=>x[0]));}
function sign(s){return crypto.createHmac('sha256',process.env.AUTH_SIGNING_KEY).update(s).digest('base64url');}
export function authRoutes(app){
 app.get('/auth/login',(req,res)=>{
  const state=crypto.randomBytes(32).toString('base64url'),nonce=crypto.randomBytes(32).toString('base64url'),verifier=crypto.randomBytes(48).toString('base64url');
  const payload=Buffer.from(JSON.stringify({state,nonce,verifier,exp:Date.now()+600000})).toString('base64url');
  res.cookie('__Host-office-oauth',payload+'.'+sign(payload),{...cookieOpts,maxAge:600000});
  const q=new URLSearchParams({response_type:'code',client_id:client,redirect_uri:origin+'/auth/callback',scope:'openid email profile',identity_provider:'EntraID',state,nonce,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
  res.redirect(domain+'/oauth2/authorize?'+q);
 });
 app.get('/auth/callback',async(req,res)=>{
  try{
   const raw=cookies(req)['__Host-office-oauth'] || '';const [payload,sig]=raw.split('.');
   if(!payload || !sig || sig.length!==sign(payload).length || !crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(sign(payload))))throw new Error('Invalid OAuth state');
   const flow=JSON.parse(Buffer.from(payload,'base64url').toString());
   if(flow.exp<Date.now() || req.query.state!==flow.state || typeof req.query.code!=='string')throw new Error('Expired OAuth state');
   res.clearCookie('__Host-office-oauth',cookieOpts);
   const r=await fetch(domain+'/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:client,redirect_uri:origin+'/auth/callback',code:req.query.code,code_verifier:flow.verifier}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Token exchange rejected');
   const token=await r.json();const claims=await identity.verify(token.id_token);
   if(claims.nonce!==flow.nonce)throw new Error('Invalid nonce');
   await access.verify(token.access_token);
   res.cookie('__Host-office-access',token.access_token,{...cookieOpts,maxAge:Math.min(token.expires_in,3600)*1000});
   if(token.refresh_token)res.cookie('__Host-office-refresh',token.refresh_token,refreshCookieOpts);
   res.redirect('/');
  }catch{res.status(401).send('No se pudo completar el acceso. Vuelve a iniciar sesión.');}
 });
 app.post('/auth/refresh',async(req,res)=>{
  if(req.headers.origin!==origin || req.headers['x-requested-with']!=='AgentOffice')return res.sendStatus(403);
  const refreshToken=cookies(req)['__Host-office-refresh'];
  if(!refreshToken)return res.status(401).json({error:'Authentication required'});
  try{
   const r=await fetch(domain+'/oauth2/token',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:client,refresh_token:refreshToken}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error('Token refresh rejected');
   const token=await r.json();await access.verify(token.access_token);
   res.cookie('__Host-office-access',token.access_token,{...cookieOpts,maxAge:Math.min(token.expires_in,3600)*1000});
   if(token.refresh_token)res.cookie('__Host-office-refresh',token.refresh_token,refreshCookieOpts);
   res.json({ok:true});
  }catch{res.clearCookie('__Host-office-access',cookieOpts);res.clearCookie('__Host-office-refresh',cookieOpts);res.status(401).json({error:'Authentication required'});}
 });
 app.post('/auth/logout',(req,res)=>{if(req.headers.origin!==origin)return res.sendStatus(403);res.clearCookie('__Host-office-access',cookieOpts);res.clearCookie('__Host-office-refresh',cookieOpts);res.json({url:domain+'/logout?'+new URLSearchParams({client_id:client,logout_uri:origin+'/'})});});
}
export async function requireAuth(req,res,next){
 try{
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):cookies(req)['__Host-office-access'];
  req.user=await access.verify(token || '');
  if(!['GET','HEAD'].includes(req.method) && !req.headers.authorization && (req.headers.origin!==origin || req.headers['x-requested-with']!=='AgentOffice'))return res.sendStatus(403);
  next();
 }catch{res.status(401).json({error:'Authentication required'});}
}
