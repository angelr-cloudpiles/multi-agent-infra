# Configuración de Amazon Bedrock AgentCore

## Alcance operativo

Agent Office invoca seis Harnesses de AgentCore mediante SigV4 desde su rol de tarea ECS. Los Harnesses no son públicos para navegadores. La interfaz web sigue autenticada por Cognito con federación Entra ID y Agent Office comprueba el token antes de crear o leer ejecuciones.

| Componente | Configuración de producción |
| --- | --- |
| Memoria | `AgentOfficeProjectMemory-N0UhKL2yls` |
| Cifrado | CMK `alias/multi-agent-agentcore-memory`, rotación anual habilitada |
| Retención de eventos | 90 días |
| Estrategias | `ProjectFacts` semántica y `ProjectSessionSummaries` |
| Harnesses | orchestrator, research, code, review, deploy y ui-design |
| API de servicio | API Gateway HTTP con autorizador JWT de Cognito, VPC Link y ALB privado |

## Aislamiento de memoria y contexto

Agent Office construye un `actorId` con el identificador de proyecto y un hash SHA-256 truncado del `sub` de Cognito. El identificador de Cognito no se guarda en la memoria. Un actor comparte los hechos durables de un proyecto para el mismo usuario; cada agente tiene su propio `runtimeSessionId` estable, por lo que los resúmenes de sesión no cruzan entre especialistas.

Las rutas de namespace son:

- `/projects/{actorId}/facts/` para decisiones, restricciones, evidencia y riesgos durables.
- `/projects/{actorId}/sessions/{sessionId}/` para resúmenes de la conversación de cada agente.

Las estrategias instruyen explícitamente no almacenar credenciales, tokens, contraseñas, secretos o datos personales. La información de repositorio y contexto inicial continúa bajo control de `services/agent-office/project-contexts/` y su revisión Git declarada en `projects.json`; AgentCore no sustituye esa fuente de verdad.

## Límites de responsabilidad

- **Amazon Bedrock y AgentCore** administran el runtime, los modelos, guardrails, cuotas y presupuestos de AWS.
- **Langfuse** administra prompts de producción, trazas, puntuaciones y evaluaciones por proyecto.
- **AgentCore Memory** conserva memoria operativa de los agentes, aislada por proyecto y usuario.
- **Agent Office** aplica la autorización, el alcance de proyecto, adjuntos y la orquestación.

No se creó una AgentCore Gateway de herramientas (MCP) porque no existe todavía un contrato OpenAPI/MCP de herramientas que deba exponerse a los agentes. Crear una Gateway vacía no aporta una integración funcional ni un límite de seguridad. Cuando se incorpore una herramienta concreta, deberá definirse su destino, credencial de mínimo privilegio, esquema de entrada/salida y una prueba de autorización antes de publicarla.

## API Gateway

La API HTTP se publica en `https://f4wx76i6c3.execute-api.us-east-1.amazonaws.com`. Sólo enruta `/api` y `/api/{proxy+}` hacia Agent Office. Exige un JWT emitido para el cliente de Cognito configurado; CORS permite únicamente `https://aiops.cloudpiles.net`. El VPC Link llega al listener HTTPS del ALB mediante una regla que exige el encabezado inyectado por la integración. La interfaz pública conserva su regla de host y Agent Office valida nuevamente el token en ambos caminos, por lo que la Gateway no es el único control de acceso.

## Operación

La configuración declarativa está en:

- `agentcore/memory-config.json` para la memoria y sus estrategias.
- `agentcore/*-agent.json` para la configuración de los Harnesses.
- `infra/runtime/agentcore-memory.tf` y `infra/runtime/agentcore.tf` para KMS e IAM.
- `infra/runtime/agent-office-api.tf` para API Gateway, VPC Link, JWT y registros.

Para una nueva organización o proyecto, se crea primero el proyecto aislado en Langfuse, se agrega el contexto versionado a `projects.json` y `project-contexts/`, y luego Agent Office generará automáticamente un espacio de memoria aislado mediante el `actorId` de ese proyecto y usuario.
