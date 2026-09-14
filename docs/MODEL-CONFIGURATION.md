# Configuración de modelos y perfiles de agentes

La ejecución de modelos se realiza directamente en **Amazon Bedrock mediante AgentCore**. LiteLLM fue retirado y no participa en el catálogo, enrutamiento, credenciales ni observabilidad.

## Fuentes de verdad

| Información | Archivo | Responsable en tiempo de ejecución |
| --- | --- | --- |
| Catálogo y capacidades de modelos | `services/agent-office/model-catalog.json` | Política del servidor de Agent Office |
| Perfil, alternativas y límites de cada agente | `services/agent-office/agent-profiles.json` | Política del servidor de Agent Office |
| Unión de alias con IDs Bedrock | `services/agent-office/server/policy.mjs` | Agent Office, antes de encolar |
| Prompt de producción y evaluación | Langfuse por proyecto | Agent Office al invocar el Harness |
| Runtime, memoria y guardrails | AgentCore | Harnesses e IAM de AWS |

El navegador no puede indicar modelos, límites, herramientas ni skills. Agent Office valida la política antes de aceptar una tarea y el runtime recibe únicamente el modelo autorizado.

## Catálogo de modelos

| Alias | Modelo Bedrock | Nivel | Capacidades |
| --- | --- | --- | --- |
| `bedrock-claude-haiku-4-5` | Claude Haiku 4.5 | rápido | texto |
| `bedrock-claude-sonnet-5` | Claude Sonnet 5 | general | texto, imagen |
| `bedrock-claude-opus-5` | Claude Opus 5 | crítico | texto, imagen |
| `bedrock-claude-fable-5-1` | Claude Fable 5.1 | creativo | texto, imagen |
| `bedrock-openai-gpt-5-6-luna` | GPT 5.6 Luna | rápido | texto, imagen |
| `bedrock-openai-gpt-5-6-terra` | GPT 5.6 Terra | razonamiento | texto, imagen |
| `bedrock-openai-gpt-5-6-sol` | GPT 5.6 Sol | código | texto, imagen |
| `bedrock-openai-gpt-6-astra` | GPT 6 Astra | frontera | texto, imagen |
| `bedrock-amazon-nova-pro` | Amazon Nova Pro | visión | texto, imagen, vídeo |

El enrutamiento es explícito. No hay un auto-router: cambiar de modelo exige actualizar el perfil del agente, revisar evaluación y publicar la configuración.

## Perfiles vigentes

| Agente | Predeterminado | Alternativas permitidas | Límite de iteraciones / timeout |
| --- | --- | --- | --- |
| Orchestrator | Claude Sonnet 5 | Haiku 4.5, GPT 5.6 Luna | 12 / 300 s |
| Research | Claude Sonnet 5 | GPT 5.6 Terra | 16 / 420 s |
| Code | Claude Sonnet 5 | GPT 5.6 Sol | 20 / 600 s |
| Review | Claude Sonnet 5 | Claude Opus 5, GPT 6 Astra | 12 / 420 s |
| Deploy | Claude Sonnet 5 | Haiku 4.5 | 12 / 300 s |
| UI Design | Claude Fable 5.1 | Amazon Nova Pro | 12 / 420 s |

`Deploy` no publica cambios por sí mismo: su resultado queda en espera de aprobación independiente. UI Design no tiene herramientas autorizadas en AgentCore.

## Cambio seguro de un perfil

1. Modificar el catálogo o perfil versionado.
2. Ejecutar `npm test` y `npm run build` en `services/agent-office`.
3. Publicar el prompt como `staging` en el proyecto Langfuse correspondiente y evaluar calidad, seguridad y coste.
4. Promover a `production` sólo si se cumplen los umbrales definidos por proyecto.
5. Desplegar una imagen inmutable y verificar una tarea no productiva, la traza y los scores en Langfuse.

Los precios no se cargan manualmente en Langfuse hasta que el SKU de AWS Price List coincida de forma verificable con el modelo e inference profile invocados. Así se evita informar costes falsos.
