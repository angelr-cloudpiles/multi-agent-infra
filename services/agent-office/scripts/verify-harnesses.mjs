import crypto from 'node:crypto';
import fs from 'node:fs';
import {BedrockAgentCoreClient, InvokeHarnessCommand} from '@aws-sdk/client-bedrock-agentcore';
import {fromIni} from '@aws-sdk/credential-providers';

const root = new URL('../', import.meta.url);
const harnesses = JSON.parse(fs.readFileSync(new URL('harnesses.json', root)));
const catalog = JSON.parse(fs.readFileSync(new URL('model-catalog.json', root)));
const profiles = JSON.parse(fs.readFileSync(new URL('agent-profiles.json', root)));
const policy = {aliases:Object.fromEntries(Object.entries(catalog.model_groups).map(([name, model]) => [name, model.model_id])),agents:Object.fromEntries(Object.entries(profiles.agents).map(([id, profile]) => [id, {alias:profile.default_model}]))};
const profile = process.env.AWS_PROFILE || 'aiops-aws';
const client = new BedrockAgentCoreClient({region: 'us-east-1', maxAttempts: 2, credentials: fromIni({profile})});

const selectedAgent = process.env.AGENT_ID;
const selectedHarnesses = selectedAgent ? [[selectedAgent, harnesses[selectedAgent]]] : Object.entries(harnesses);
if (selectedAgent && !selectedHarnesses[0][1]) throw new Error(`Unknown agent: ${selectedAgent}`);

for (const [agentId, deployment] of selectedHarnesses) {
  const agent = policy.agents[agentId];
  let output = '';
  let streamFailure;
  try {
    const response = await client.send(new InvokeHarnessCommand({
      harnessArn: deployment.arn,
      runtimeSessionId: crypto.randomUUID(),
      messages: [{role: 'user', content: [{text: 'Reply with exactly: READY'}]}],
      model: {bedrockModelConfig: {modelId: policy.aliases[agent.alias], maxTokens: 64, apiFormat: 'converse_stream'}},
      maxIterations: 1,
      maxTokens: 64,
      timeoutSeconds: 30
    }));
    for await (const event of response.stream) {
      if (event.contentBlockDelta?.delta?.text) output += event.contentBlockDelta.delta.text;
      streamFailure ||= ['runtimeClientError', 'validationException', 'internalServerException'].find((key) => event[key]);
    }
  } catch (error) {
    console.error(`${agentId}: FAIL ${error.name}`);
    process.exitCode = 1;
    continue;
  }
  if (streamFailure || !output.toUpperCase().includes('READY')) {
    console.error(`${agentId}: FAIL ${streamFailure || 'unexpected response'}`);
    process.exitCode = 1;
  } else {
    console.log(`${agentId}: PASS`);
  }
}
