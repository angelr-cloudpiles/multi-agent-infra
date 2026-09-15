# Multi-Agent Infrastructure

Plataforma de operación de agentes para equipos y proyectos aislados. La arquitectura vigente es **Agent Office + Amazon Bedrock AgentCore + Langfuse**; LiteLLM fue retirado y no forma parte del camino de ejecución.

## Componentes

- **Agent Office** (`services/agent-office`): aplicación autenticada, proyectos, tareas, conversaciones, adjuntos y mapa operativo.
- **Amazon Bedrock AgentCore**: Harnesses, memoria aislada, modelos, guardrails y ejecución de agentes.
- **Langfuse**: prompts versionados, trazas, sesiones, puntuaciones, anotación humana y evaluaciones.
- **AWS**: ECS/Fargate, SQS FIFO, DynamoDB, S3 cifrado, Cognito federado con Entra ID, API Gateway y CloudWatch.

## Agentes disponibles

| Agente | Responsabilidad |
| --- | --- |
| Orchestrator | Descompone, delega y sintetiza una tarea. |
| Research | Investiga el contexto y evidencia disponible. |
| Code | Implementa cambios cuando el proyecto lo permite. |
| Review | Revisa calidad, riesgo y consistencia. |
| Deploy | Prepara entregas sujetas a aprobación independiente. |
| UI Design | Evalúa y diseña la experiencia de interfaz. |

## Flujo de trabajo

1. Iniciar sesión en [Agent Office](https://aiops.cloudpiles.net) mediante Entra ID.
2. Elegir la organización/proyecto y crear una tarea desde la conversación.
3. Continuar el mismo hilo hasta cerrarlo; usar **Nueva tarea** para un pedido independiente.
4. Si un agente requiere atención, abrir **Revisar tarea que requiere atención**. La vista muestra únicamente esa tarea y sus continuaciones.
5. Consultar trazas y evaluaciones en [Langfuse](https://langfuse.aiops.cloudpiles.net).

Los proyectos de solo lectura pueden analizar el contexto versionado, pero no mutar repositorios, AWS ni CI/CD.

## Desarrollo y validación

```bash
cd services/agent-office
npm ci
npm test
npm run build
```

La documentación operativa se encuentra en:

- [Manual de usuario](docs/user-manual.md)
- [Manual de integración desde IDE](docs/IDE-AGENT-INTEGRATION-MANUAL.md)
- [Manual de administración](docs/admin-manual.md)
- [Arquitectura Bedrock AgentCore y Langfuse](docs/ARCHITECTURE-BEDROCK-LANGFUSE.md)
- [Configuración de AgentCore](docs/AGENTCORE-CONFIGURATION.md)
- [Configuración de modelos y perfiles](docs/MODEL-CONFIGURATION.md)
- [Operación de Langfuse y AgentCore](docs/LANGFUSE-AGENTCORE-OPERATIONS.md)
- [Migración de proyectos](docs/project-migration.md)
