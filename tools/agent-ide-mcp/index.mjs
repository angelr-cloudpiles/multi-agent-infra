import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const execFileAsync = promisify(execFile);
const discoveryUrl = process.env.AIOPS_AGENT_DISCOVERY_URL || 'https://aiops.cloudpiles.net/.well-known/aiops-agent-gateway.json';
const callbackPort = Number(process.env.AIOPS_AGENT_CALLBACK_PORT || '19876');
const callbackPath = '/oauth/callback';
const stateDirectory = process.env.AIOPS_AGENT_STATE_DIR || path.join(os.homedir(), '.config', 'aiops-agent-mcp');
const statePath = path.join(stateDirectory, 'session.json');

export function callbackUrl() {
  return `http://127.0.0.1:${callbackPort}${callbackPath}`;
}

export function verifyGatewayConfig(config) {
  for (const name of ['gateway_url', 'authorization_endpoint', 'token_endpoint', 'client_id']) {
    if (typeof config?.[name] !== 'string' || !config[name]) throw new Error(`Gateway discovery is missing ${name}`);
  }
  for (const name of ['gateway_url', 'authorization_endpoint', 'token_endpoint']) {
    const url = new URL(config[name]);
    if (url.protocol !== 'https:' && process.env.AIOPS_AGENT_ALLOW_HTTP !== 'true') throw new Error(`${name} must use HTTPS`);
  }
  return config;
}

export async function discoverGateway(fetchImpl = fetch) {
  const response = await fetchImpl(discoveryUrl, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Gateway discovery failed with HTTP ${response.status}`);
  return verifyGatewayConfig(await response.json());
}

export function createPkce() {
  const verifier = crypto.randomBytes(48).toString('base64url');
  return { verifier, challenge: crypto.createHash('sha256').update(verifier).digest('base64url') };
}

async function saveSession(session) {
  await fs.mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  await fs.writeFile(statePath, `${JSON.stringify(session)}\n`, { mode: 0o600 });
  await fs.chmod(statePath, 0o600);
}

async function loadSession() {
  try { return JSON.parse(await fs.readFile(statePath, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Unable to read the local IDE session');
  }
}

async function openBrowser(url) {
  if (process.platform === 'darwin') return execFileAsync('open', [url]);
  if (process.platform === 'win32') return execFileAsync('cmd', ['/c', 'start', '', url]);
  return execFileAsync('xdg-open', [url]);
}

function waitForAuthorization(expectedState) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, callbackUrl());
      if (url.pathname !== callbackPath) { response.writeHead(404).end(); return; }
      if (url.searchParams.get('state') !== expectedState || !url.searchParams.get('code')) {
        response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('La autorización no pudo verificarse. Volvé al IDE e inténtalo nuevamente.');
        return;
      }
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Autorización completada. Podés cerrar esta ventana y volver al IDE.');
      const code = url.searchParams.get('code');
      server.close(() => resolve(code));
    });
    server.once('error', reject);
    server.listen(callbackPort, '127.0.0.1');
    setTimeout(() => server.close(() => reject(new Error('The browser login timed out after 5 minutes'))), 300000).unref();
  });
}

export async function login({ discover = discoverGateway, open = openBrowser, wait = waitForAuthorization, fetchImpl = fetch } = {}) {
  const config = await discover();
  const state = crypto.randomBytes(32).toString('base64url');
  const pkce = createPkce();
  const authorize = new URL(config.authorization_endpoint);
  authorize.search = new URLSearchParams({
    response_type: 'code',
    client_id: config.client_id,
    redirect_uri: callbackUrl(),
    scope: config.scopes || 'openid email profile',
    identity_provider: config.identity_provider || 'EntraID',
    state,
    code_challenge_method: 'S256',
    code_challenge: pkce.challenge
  }).toString();
  await open(authorize.toString());
  const code = await wait(state);
  const response = await fetchImpl(config.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: config.client_id, redirect_uri: callbackUrl(), code, code_verifier: pkce.verifier }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('Token exchange was rejected');
  const token = await response.json();
  if (!token.access_token || !token.refresh_token || !token.expires_in) throw new Error('The authorization response did not contain a renewable session');
  await saveSession({ config, access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + Number(token.expires_in) * 1000 });
  return { gateway_url: config.gateway_url, expires_at: new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() };
}

async function accessToken(fetchImpl = fetch) {
  const session = await loadSession();
  if (!session) throw new Error('No active IDE session. Run: npm run login --prefix tools/agent-ide-mcp');
  if (session.expires_at > Date.now() + 60000) return session.access_token;
  const response = await fetchImpl(session.config.token_endpoint, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: session.config.client_id, refresh_token: session.refresh_token }), signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('The IDE session expired. Run the login command again.');
  const token = await response.json();
  session.access_token = token.access_token;
  session.refresh_token = token.refresh_token || session.refresh_token;
  session.expires_at = Date.now() + Number(token.expires_in) * 1000;
  await saveSession(session);
  return session.access_token;
}

async function apiRequest(pathname, { method = 'GET', body } = {}) {
  const session = await loadSession();
  if (!session) throw new Error('No active IDE session. Run: npm run login --prefix tools/agent-ide-mcp');
  const response = await fetch(new URL(pathname, session.config.gateway_url), {
    method,
    headers: { authorization: `Bearer ${await accessToken()}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Gateway request failed with HTTP ${response.status}`);
  return payload;
}

function jsonResult(payload) { return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }; }
function errorResult(error) { return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }; }

export const tools = [
  { name: 'projects.list', description: 'Lists projects available to the signed-in user.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'agents.list', description: 'Lists the agents enabled for one project.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' } }, required: ['project_id'], additionalProperties: false } },
  { name: 'tasks.create', description: 'Creates an explicit root task. Use orchestrator-agent unless the user selects another enabled agent.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, message: { type: 'string' }, agent_id: { type: 'string' } }, required: ['project_id', 'message'], additionalProperties: false } },
  { name: 'agents.chat', description: 'Starts or continues a project conversation. The first message creates its root task; later messages reuse task_id.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, message: { type: 'string' }, task_id: { type: 'string' }, agent_id: { type: 'string' } }, required: ['project_id', 'message'], additionalProperties: false } },
  { name: 'tasks.status', description: 'Returns the current state, results and AgentCore/Langfuse identifiers for one task.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, task_id: { type: 'string' } }, required: ['project_id', 'task_id'], additionalProperties: false } },
  { name: 'tasks.messages', description: 'Returns the conversation for one root task.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, task_id: { type: 'string' } }, required: ['project_id', 'task_id'], additionalProperties: false } },
  { name: 'tasks.continue', description: 'Adds a decision or detail to an existing root task.', inputSchema: { type: 'object', properties: { project_id: { type: 'string' }, task_id: { type: 'string' }, message: { type: 'string' } }, required: ['project_id', 'task_id', 'message'], additionalProperties: false } }
];

async function callTool(name, args) {
  if (name === 'projects.list') return apiRequest('/api/config');
  if (name === 'agents.list') { const config = await apiRequest('/api/config'); const project = config.projects?.find((item) => item.project_id === args.project_id); if (!project) throw new Error('Project is not available to this user'); return { project_id: project.project_id, agents: (config.agents || []).filter((agent) => project.allowed_agents.includes(agent.id)) }; }
  if (name === 'tasks.create') return apiRequest('/api/chat', { method: 'POST', body: { project_id: args.project_id, message: args.message, agent_id: args.agent_id || 'orchestrator-agent', attachments: [] } });
  if (name === 'agents.chat') {
    if (args.task_id) return apiRequest(`/api/tasks/${encodeURIComponent(args.task_id)}/messages?project_id=${encodeURIComponent(args.project_id)}`, { method: 'POST', body: { message: args.message, attachments: [] } });
    return apiRequest('/api/chat', { method: 'POST', body: { project_id: args.project_id, message: args.message, agent_id: args.agent_id || 'orchestrator-agent', attachments: [] } });
  }
  if (name === 'tasks.status') { const snapshot = await apiRequest(`/api/snapshot?project_id=${encodeURIComponent(args.project_id)}`); const task = snapshot.runs?.find((run) => run.run_id === args.task_id); if (!task) throw new Error('Task was not found'); return task; }
  if (name === 'tasks.messages') return apiRequest(`/api/tasks/${encodeURIComponent(args.task_id)}/chat?project_id=${encodeURIComponent(args.project_id)}`);
  if (name === 'tasks.continue') return apiRequest(`/api/tasks/${encodeURIComponent(args.task_id)}/messages?project_id=${encodeURIComponent(args.project_id)}`, { method: 'POST', body: { message: args.message, attachments: [] } });
  throw new Error('Unknown MCP tool');
}

export async function serve() {
  const server = new Server({ name: 'cloudpiles-agent-gateway', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try { return jsonResult(await callTool(request.params.name, request.params.arguments || {})); } catch (error) { return errorResult(error); }
  });
  await server.connect(new StdioServerTransport());
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2] || 'serve';
  if (command === 'login') login().then((result) => process.stdout.write(`IDE session ready for ${result.gateway_url}. Expires at ${result.expires_at}.\n`)).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  else if (command === 'serve') serve().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
  else { process.stderr.write('Usage: node index.mjs [login|serve]\n'); process.exitCode = 64; }
}
