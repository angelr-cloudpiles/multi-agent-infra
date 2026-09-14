import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { context } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { propagateAttributes, setLangfuseTracerProvider, startObservation } from '@langfuse/tracing';

const baseUrl = process.env.LANGFUSE_BASE_URL || 'https://langfuse.aiops.cloudpiles.net';
const providers = new Map();
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());

function bounded(value, fallback = 'unknown') {
  const text = String(value ?? fallback);
  return text.slice(0, 200);
}

function metadataFor({ project, runId, agentId, alias, requesterHash, prompt }) {
  return {
    project_id: bounded(project.project_id),
    langfuse_project_id: bounded(project.langfuse.project_id),
    model_provider: 'amazon-bedrock',
    agent_runtime: 'bedrock-agentcore',
    bedrock_region: bounded(project.bedrock.region),
    run_id: bounded(runId),
    agent_id: bounded(agentId),
    model_alias: bounded(alias),
    access_mode: bounded(project.access_mode),
    organization_id: bounded(project.langfuse.organization_id),
    identity_provider: 'microsoft-entra-id',
    requester_hash: bounded(requesterHash),
    prompt_name: bounded(prompt?.name, 'fallback'),
    prompt_version: bounded(prompt?.version, 'fallback')
  };
}

export function createLangfuseV4Provider({ project, keys, spanProcessor }) {
  return new NodeTracerProvider({
    spanProcessors: [spanProcessor || new LangfuseSpanProcessor({
      publicKey: keys.public_key,
      secretKey: keys.secret_key,
      baseUrl,
      environment: project.environment,
      mediaUploadEnabled: false
    })]
  });
}

function providerFor(project, keys) {
  const id = project.langfuse.project_id;
  if (!providers.has(id)) providers.set(id, createLangfuseV4Provider({ project, keys }));
  return providers.get(id);
}

export async function recordLangfuseV4Generation({ project, keys, runId, agentId, alias, sessionId, requesterHash, request, output, usage, startedAt, prompt, provider }) {
  const tracerProvider = provider || providerFor(project, keys);
  setLangfuseTracerProvider(tracerProvider);
  const metadata = metadataFor({ project, runId, agentId, alias, requesterHash, prompt });
  const traceAttributes = {
    traceName: 'agent-office.run',
    userId: bounded(requesterHash),
    sessionId: bounded(sessionId),
    environment: bounded(project.environment),
    tags: ['agent-office', bounded(project.project_id), bounded(project.langfuse.organization_id), 'bedrock-agentcore'],
    metadata
  };
  return propagateAttributes(traceAttributes, async () => {
    const root = startObservation('agent-office.run', {
      input: { request },
      metadata
    }, { asType: 'agent', startTime: startedAt });
    const generation = startObservation(`bedrock.${alias}`, {
      input: { request, agentId },
      model: alias,
      modelParameters: { maxTokens: 4096 },
      prompt: prompt ? { name: prompt.name, version: prompt.version, isFallback: false } : undefined
    }, { asType: 'generation', startTime: startedAt, parentSpanContext: root.otelSpan.spanContext() });
    generation.update({
      output: { content: output },
      usageDetails: usage ? {
        promptTokens: usage.inputTokens,
        completionTokens: usage.outputTokens,
        totalTokens: usage.totalTokens
      } : undefined
    });
    root.update({ output: { content: output } });
    generation.end();
    root.end();
    return { traceId: root.traceId, observationId: generation.id };
  });
}

export async function flushLangfuseV4Providers() {
  await Promise.all([...providers.values()].map((provider) => provider.forceFlush()));
}
