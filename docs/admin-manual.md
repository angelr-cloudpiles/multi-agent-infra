# Manual de administración de Agent Office

Este manual describe la operación vigente de la plataforma: **Agent Office + Amazon Bedrock AgentCore + Langfuse**. LiteLLM fue retirado; no se deben reactivar servicios, secretos, rutas ni procedimientos asociados a ese componente.

## Arquitectura operativa

| Componente | Responsabilidad | Superficie de operación |
| --- | --- | --- |
| Agent Office | Autenticación, tareas, conversaciones, adjuntos y orquestación | ECS `multi-agent-platform` / servicio `multi-agent-agent-office` |
| Bedrock AgentCore | Harnesses, memoria, modelos, guardrails y herramientas autorizadas | AWS Bedrock AgentCore |
| Langfuse | Prompts, trazas, scores, anotación y evaluaciones | `https://langfuse.aiops.cloudpiles.net` |
| Cognito + Entra ID | Inicio de sesión y autorización del navegador | Cognito, federación Microsoft Entra ID |
| DynamoDB, SQS y S3 | Estado de tareas, cola y adjuntos | AWS administrado |

La documentación de diseño y configuración se mantiene en [ARCHITECTURE-BEDROCK-LANGFUSE.md](ARCHITECTURE-BEDROCK-LANGFUSE.md) y [AGENTCORE-CONFIGURATION.md](AGENTCORE-CONFIGURATION.md).

## Controles de acceso

- El navegador sólo recibe contenido después de una sesión válida de Entra ID/Cognito.
- Agent Office aplica el alcance de proyecto en cada API y antes de encolar una ejecución.
- Los proyectos de solo lectura no pueden desplegar ni modificar recursos.
- Las aprobaciones de despliegue exigen una identidad independiente en el grupo `aiops-approvers`.
- Las claves de Langfuse, AWS y credenciales de runtime permanecen en Secrets Manager; nunca se colocan en el frontend, documentación de usuario ni logs.

## Operación diaria

### Verificar salud de Agent Office

```bash
AWS_PROFILE=aiops-aws AWS_REGION=us-east-1 \
aws ecs describe-services \
  --cluster multi-agent-platform \
  --services multi-agent-agent-office \
  --query 'services[0].{running:runningCount,desired:desiredCount,pending:pendingCount,deployments:deployments[].{taskDefinition:taskDefinition,status:status,rolloutState:rolloutState}}' \
  --output json

curl -fsS https://aiops.cloudpiles.net/healthz
```

El servicio está sano cuando `running` coincide con `desired`, no hay tareas pendientes y el despliegue primario está en `COMPLETED`.

### Revisar fallos de tarea

1. Abrir el proyecto en Agent Office.
2. Seleccionar el agente con estado de atención.
3. Usar **Revisar tarea que requiere atención**.
4. Verificar si hay resultados preservados y decidir entre reintentar síntesis o aportar contexto.
5. Abrir Langfuse desde el panel de trazas para inspeccionar la ejecución, prompt, uso y evaluación.

Una continuación por asistencia debe cerrar la tarea raíz cuando concluye. Si el detalle queda en `Requiere atención` pese a que aparece una respuesta final, conserve los identificadores de tarea y traza, revise el error de DynamoDB en los logs del servicio y no cree otra tarea para compensarlo.

El estado del mapa se calcula desde las tareas raíz aún abiertas. Una continuación histórica con error no puede mantener al agente en **Requiere atención** si su tarea raíz ya quedó completada; los eventos y trazas de esa continuación siguen disponibles en el hilo y en Langfuse.

No borre una tarea para resolver un error: el hilo y los resultados preservados son evidencia operativa.

### Verificar observabilidad

Por cada proyecto, comprobar en Langfuse:

- que las generaciones contengan `project_id`, `run_id`, `agent_id` y el entorno;
- que las sesiones estén seudonimizadas;
- que existan scores de feedback humano;
- que prompts y evaluadores activos correspondan al proyecto.

La ausencia de una traza no autoriza a repetir una tarea destructiva. Primero confirme el estado en Agent Office, la cola y los logs del runtime.

Para revisar los Harnesses efectivos sin invocar una tarea, consulte `GetHarness` con el perfil autorizado. El resultado debe mostrar `READY`, la memoria `AgentOfficeProjectMemory-N0UhKL2yls` y los límites de modelo esperados. No se registran skills ni herramientas MCP en AgentCore mientras no exista un contrato autorizado para una herramienta concreta.

## Despliegue de Agent Office

Los cambios se validan antes de publicar:

```bash
cd services/agent-office
npm ci
npm test
npm run build
```

El despliegue publicado debe registrar una imagen inmutable en ECR y una revisión nueva de la task definition. Tras actualizar el servicio, espere a que ECS estabilice y ejecute el healthcheck anterior. Conserve el identificador de task definition en el cambio o ticket operativo.

**Registro de despliegue vigente (14/09/2026):** revisión ECS `47`, imagen `sha256:6b0c1d7ca8206aeea176bb7e1a8dd6758f8879ab4ddc5ff8beedcbac0d38bc7c`, estado `COMPLETED`, una tarea en ejecución y healthcheck `/healthz` correcto.

Si una revisión nueva no carga la interfaz, revierta a la última task definition saludable, espere el estado `COMPLETED` y registre la causa antes de volver a desplegar.

## Operación del mapa y chat

El mapa sólo representa eventos de Agent Office. Una delegación mueve el control del Orchestrator completo; el sprite no debe duplicarse ni separarse de su nombre, estado o anillo. Si se observa un artefacto visual:

1. identificar la revisión de frontend desplegada;
2. comprobar que no exista un elemento `.pixel-dispatch-courier` en el bundle;
3. validar que el contenedor `.pixel-agent-control.dispatching` sea el elemento que cambia de posición;
4. probar una delegación no productiva antes de publicar una corrección.

La vista de asistencia debe solicitar `GET /api/tasks/{id}/chat` y mostrar sólo el hilo de esa tarea. El endpoint general `GET /api/chat` es una vista reciente del proyecto y no sirve para reconstruir tareas antiguas.

## Cambios de proyectos

Para incorporar o migrar un proyecto:

1. Crear o seleccionar la organización y el proyecto en Langfuse.
2. Registrar el proyecto, alcance, contexto versionado y repositorio en `projects.json` y `project-contexts/`.
3. Sincronizar prompts, datasets, scores y evaluadores del proyecto.
4. Confirmar los permisos de AgentCore, memoria y herramientas permitidas.
5. Ejecutar una tarea no productiva y verificar la cadena completa en Agent Office y Langfuse.

Consulte [project-migration.md](project-migration.md) para el procedimiento detallado.

## Incidentes y recuperación

- **Acceso fallido:** revisar la configuración de Cognito, federación Entra ID, callback URL y logs de autenticación.
- **Tarea en error:** preservar el hilo; inspeccionar la causa, traza y resultados parciales antes de reintentar.
- **Problema de runtime:** verificar el estado del harness, IAM, guardrail y cuota de Bedrock antes de aumentar reintentos.
- **Fallo de frontend:** revertir al último task definition sano y validar carga autenticada, proyectos, chat y asistencia.
- **Cambios de infraestructura:** ejecutar `terraform fmt`, `terraform validate` y revisar un plan en el workspace correcto antes de aplicar.

Toda recuperación debe dejar evidencia: hora, proyecto, tarea o revisión afectada, acción aplicada, resultado y rollback disponible.
