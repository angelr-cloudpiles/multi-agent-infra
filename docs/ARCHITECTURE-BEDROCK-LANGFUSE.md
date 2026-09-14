# Arquitectura Bedrock AgentCore y Langfuse

## Flujo de ejecución

1. Agent Office recibe una solicitud autenticada y la asocia a un proyecto.
2. El perfil del agente y el contexto versionado se cargan desde Langfuse y el repositorio del proyecto.
3. Agent Office invoca el harness correspondiente de Amazon Bedrock AgentCore.
4. AgentCore usa la memoria aislada por proyecto, agente y usuario, y ejecuta las herramientas autorizadas.
5. Agent Office registra la traza, uso y metadatos del proyecto en Langfuse.

## Responsabilidades

| Componente | Responsabilidad |
| --- | --- |
| Amazon Bedrock | Modelos, cuotas y facturación de inferencia. |
| Bedrock AgentCore | Harnesses, memoria, herramientas, gateways y guardrails. |
| Langfuse | Proyectos, prompts, trazas, evaluaciones y promoción de prompts. |
| Agent Office | Autenticación, orquestación, conversaciones y contexto por proyecto. |

Langfuse usa una conexión `agent-office-bedrock` con sus credenciales AWS por defecto del rol ECS. El rol queda limitado al perfil de inferencia de Haiku usado por los evaluadores. No se almacenan credenciales AWS estáticas en Langfuse.

Redis se mantiene como dependencia de Langfuse. LiteLLM fue retirado; se conservan sus snapshots manual y final de base de datos como respaldo del desmantelamiento.

## Operación

Los costos se controlan mediante AWS Budgets y Cost and Usage Report. Los guardrails se aplican en los harnesses de AgentCore; las evaluaciones de Langfuse usan muestreo del 10% para controlar el costo de evaluación.
