import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const projectId = process.env.LANGFUSE_PROJECT_ID;
const secretIds = {
  'multi-agent': 'multi-agent-langfuse-keys',
  'tattoo-studio': 'multi-agent-langfuse-tattoo-studio-keys'
};
if (!secretIds[projectId]) throw new Error('LANGFUSE_PROJECT_ID must be multi-agent or tattoo-studio');

const sm = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
const secret = await sm.send(new GetSecretValueCommand({ SecretId: secretIds[projectId] }));
const keys = JSON.parse(secret.SecretString);
const authorization = `Basic ${Buffer.from(`${keys.public_key}:${keys.secret_key}`).toString('base64')}`;
const client = new Client({ name: `agent-office-langfuse-${projectId}`, version: '1.0.0' }, { capabilities: {} });
await client.connect(new StreamableHTTPClientTransport(new URL('https://langfuse.aiops.cloudpiles.net/api/public/mcp'), {
  requestInit: { headers: { Authorization: authorization } }
}));

const server = new Server({ name: `langfuse-${projectId}`, version: '1.0.0' }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => client.listTools());
server.setRequestHandler(CallToolRequestSchema, async (request) => client.callTool(request.params));
await server.connect(new StdioServerTransport());
