import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { callbackUrl, createPkce, tools, verifyGatewayConfig } from './index.mjs';

test('uses the fixed loopback callback registered in Cognito', () => {
  assert.equal(callbackUrl(), 'http://127.0.0.1:19876/oauth/callback');
});

test('generates a valid PKCE pair', () => {
  const first = createPkce();
  const second = createPkce();
  assert.match(first.verifier, /^[A-Za-z0-9_-]+$/);
  assert.match(first.challenge, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(first.verifier, second.verifier);
});

test('rejects an insecure gateway outside local development', () => {
  assert.throws(() => verifyGatewayConfig({ gateway_url: 'http://gateway.example', authorization_endpoint: 'https://auth.example', token_endpoint: 'https://auth.example/token', client_id: 'client' }), /HTTPS/);
});

test('publishes the project, agent, task and conversation tools', () => {
  assert.deepEqual(tools.map((tool) => tool.name), ['projects.list', 'agents.list', 'tasks.create', 'agents.chat', 'tasks.status', 'tasks.messages', 'tasks.continue']);
});

test('accepts a real MCP stdio tools/list handshake', async () => {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const transport = new StdioClientTransport({ command: process.execPath, args: ['index.mjs', 'serve'], cwd: root, stderr: 'pipe' });
  const client = new Client({ name: 'agent-ide-mcp-test', version: '1.0.0' }, { capabilities: {} });
  await client.connect(transport);
  const result = await client.listTools();
  assert.deepEqual(result.tools.map((tool) => tool.name), tools.map((tool) => tool.name));
  await client.close();
});
