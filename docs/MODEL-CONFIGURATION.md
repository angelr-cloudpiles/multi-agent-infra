# Modelo, agente y observabilidad: límites de responsabilidad

> **Actualización de arquitectura:** la ejecución de modelos se realiza directamente en Amazon Bedrock mediante AgentCore. LiteLLM fue retirado; los perfiles vigentes están en `services/agent-office/agent-profiles.json` y `services/agent-office/model-catalog.json`. El contenido siguiente se conserva como referencia histórica.

## LiteLLM: catálogo de despliegues

LiteLLM administra despliegues de proveedores y grupos de modelos. Sus nombres
describen proveedor y modelo, nunca un rol de agente:

| Grupo LiteLLM | Despliegue Bedrock | Capacidades |
|---|---|---|
| `bedrock-claude-haiku-4-5` | Claude Haiku 4.5 | Texto |
| `bedrock-claude-sonnet-5` | Claude Sonnet 5 | Texto, imagen |
| `bedrock-claude-opus-5` | Claude Opus 5 | Texto, imagen |
| `bedrock-claude-fable-5-1` | Claude Fable 5.1 | Texto, imagen |
| `bedrock-openai-gpt-5-6-luna` | GPT 5.6 Luna | Texto, imagen |
| `bedrock-openai-gpt-5-6-terra` | GPT 5.6 Terra | Texto, imagen |
| `bedrock-openai-gpt-5-6-sol` | GPT 5.6 Sol | Texto, imagen |
| `bedrock-openai-gpt-6-astra` | GPT 6 Astra | Texto, imagen |
| `bedrock-amazon-nova-pro` | Amazon Nova Pro | Texto, imagen, vídeo |

Cada equipo de LiteLLM recibe sólo estos grupos mediante una clave virtual de
proyecto. Los grupos son la capa para permisos, límites, presupuestos, health
checks, fallbacks y observabilidad del gateway.

`Auto-Routers` se mantiene sin configurar: LiteLLM lo declara beta. No se
habilita un selector automático hasta tener evaluaciones de Langfuse que
demuestren calidad, coste y comportamiento de fallback por cada tarea.

## Agent Office y AgentCore: perfiles de agente

Los perfiles viven en `services/agent-office/agent-profiles.json`. Cada uno
declara su propósito, grupo predeterminado, alternativas permitidas, límites de
iteraciones y timeout. Por ejemplo, `code-agent` puede usar Sonnet 5 o GPT 5.6
Sol, pero no puede seleccionar Opus o Nova Pro sin que se cambie su perfil.

Los prompts versionados y los contratos de evaluación viven por proyecto en
Langfuse. Las identidades operativas siguen siendo los Harnesses de AgentCore.

El endpoint `/v1/agents` de LiteLLM no es un editor de perfiles de modelo: es
un registro A2A para agentes que ya exponen una `AgentCard` y un endpoint A2A.
No se registran entradas ficticias allí. Cuando Agent Office exponga su
adaptador A2A, cada agente podrá registrarse en LiteLLM con su URL, capacidades
y autenticación reales.

## Integración LiteLLM y Langfuse

La integración nativa se activa en LiteLLM con `langfuse_otel` y credenciales
de un proyecto Langfuse. Entonces cada llamada que atraviesa el proxy aporta
tokens, coste y latencia a Langfuse.

La ejecución actual de los Harnesses usa AgentCore -> Bedrock directamente.
Por eso LiteLLM es hoy control-plane de catálogo y equipos, mientras Langfuse
recibe la telemetría de Agent Office de forma explícita. Para que LiteLLM sea
la fuente de gasto por proyecto hay que mover el data-plane de inferencia al
proxy o introducir un adaptador de ejecución que llame a `/v1/responses` de
LiteLLM; no basta con añadir un callback.

## Fuentes de verdad

- Despliegues LiteLLM: `services/litellm/config.yaml`.
- Catálogo semántico: `services/agent-office/model-catalog.json`.
- Perfiles de agente: `services/agent-office/agent-profiles.json`.
- Unión segura para AgentCore: `services/agent-office/server/policy.mjs`.
- Prompts, datasets y evaluaciones: `scripts/sync-langfuse-project.mjs`.
