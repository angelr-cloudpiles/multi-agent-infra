# Migración de proyectos Langfuse v4

Destino confirmado: `https://langfuse.aiops.cloudpiles.net`, Langfuse OSS `v4.35.0`. Alcance: los proyectos `multi-agent` (Gaudi) y `tattoo-studio` (Fede Rod Tattoo Studio).

Agent Office usa `@langfuse/tracing` y `@langfuse/otel` `5.11.1`, con `@opentelemetry/sdk-node` `0.222.0`. Cada proyecto crea observaciones OTEL v4 con su propia clave: una raíz `agent-office.run` y una generación hija de Bedrock. El contexto de proyecto, entorno, usuario seudonimizado y sesión se propaga a ambas observaciones; los input/output quedan en la raíz y en la generación.

| Área | Estado | Evidencia, bloqueo y siguiente acción |
| --- | --- | --- |
| project access | ready | Se confirmaron ambos proyectos mediante API de proyecto y UI autenticada en Langfuse v4.35.0. |
| SDK/instrumentation | changed | Se reemplazó la ingestión batch heredada por OTEL v4 con SDK JS/TS v5.11.1; la lectura usa Observations API v2 con rango temporal y cursor. |
| trace evaluators | ready | Contrato de configuración verificado por proyecto: dos evaluadores LLM-as-a-Judge y una regla activa al 10% sobre `GENERATION`. La validación no productiva de Tattoo Studio produjo observaciones `AGENT` y `GENERATION`; la siguiente acción es revisar la muestra evaluada antes de cambiar el modo de escritura configurado. |
| dataset evaluators | ready | Se verificaron dos datasets por proyecto, cero experimentos y ninguna regla o evaluador activo dirigido a datasets. |
| direct APIs | changed | Se eliminó el uso de `/api/public/ingestion` y `/api/public/traces`; quedan `/api/public/v2/observations` con `fromStartTime`, `toStartTime` y cursor. El panel v4 conserva avisos de llamadas históricas durante su ventana de detección. |
| exports | blocked | La consulta de Blob Storage devuelve `403 Organization-scoped API key required`; con claves de proyecto no puede revisarse ni migrarse la fuente. Siguiente acción: revisar [Gaudi Settings](https://langfuse.aiops.cloudpiles.net/project/multi-agent/settings) y [Tattoo Studio Settings](https://langfuse.aiops.cloudpiles.net/project/tattoo-studio/settings) con una clave de organización, preservando credenciales, prefijos y programación. |
| verification/rollback | ready | El 14 de septiembre se repitió la validación no productiva de Tattoo Studio tras la corrección de persistencia. La tarea raíz `c2f50f45` quedó `completed` sin error; la continuación `f06ac4e8` registró la traza `793faa41ad67f02a031abdaefce574a5` con una observación `AGENT` y otra `GENERATION`. La tarea directa de UI Design `27245554` también quedó completada con la traza `905950cf6cc71096a72cc0b7fbb0aa60`. |

Las pruebas locales verifican el árbol de observaciones v4 y la propagación de contexto. La revisión desplegada de Agent Office es la task definition ECS `47`, con imagen inmutable `sha256:6b0c1d7ca8206aeea176bb7e1a8dd6758f8879ab4ddc5ff8beedcbac0d38bc7c`.
