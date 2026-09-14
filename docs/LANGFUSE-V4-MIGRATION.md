# Migración de proyectos Langfuse v4

Destino confirmado: `https://langfuse.aiops.cloudpiles.net`, Langfuse OSS `v4.35.0`. Alcance: los proyectos `multi-agent` (Gaudi) y `tattoo-studio` (Fede Rod Tattoo Studio).

Agent Office usa `@langfuse/tracing` y `@langfuse/otel` `5.11.1`, con `@opentelemetry/sdk-node` `0.222.0`. Cada proyecto crea observaciones OTEL v4 con su propia clave: una raíz `agent-office.run` y una generación hija de Bedrock. El contexto de proyecto, entorno, usuario seudonimizado y sesión se propaga a ambas observaciones; los input/output quedan en la raíz y en la generación.

| Área | Estado | Evidencia, bloqueo y siguiente acción |
| --- | --- | --- |
| project access | ready | Se confirmaron ambos proyectos mediante API de proyecto y UI autenticada en Langfuse v4.35.0. |
| SDK/instrumentation | changed | Se reemplazó la ingestión batch heredada por OTEL v4 con SDK JS/TS v5.11.1; la lectura usa Observations API v2 con rango temporal y cursor. |
| trace evaluators | changed | Contrato de configuración verificado en proyecto: dos evaluadores LLM-as-a-Judge y una regla activa al 10% sobre `GENERATION` en cada proyecto; no hay filas Legacy en [Gaudi Evaluators](https://langfuse.aiops.cloudpiles.net/project/multi-agent/evals) ni [Tattoo Studio Evaluators](https://langfuse.aiops.cloudpiles.net/project/tattoo-studio/evals). No hay observaciones representativas para comparar resultados; ejecutar una tarea no productiva y revisar scores antes de cambiar `dual` a `direct`. |
| dataset evaluators | ready | Se verificaron dos datasets por proyecto, cero experimentos y ninguna regla o evaluador activo dirigido a datasets. |
| direct APIs | changed | Se eliminó el uso de `/api/public/ingestion` y `/api/public/traces`; quedan `/api/public/v2/observations` con `fromStartTime`, `toStartTime` y cursor. El panel v4 conserva avisos de llamadas históricas durante su ventana de detección. |
| exports | blocked | La consulta de Blob Storage devuelve `403 Organization-scoped API key required`; con claves de proyecto no puede revisarse ni migrarse la fuente. Siguiente acción: revisar [Gaudi Settings](https://langfuse.aiops.cloudpiles.net/project/multi-agent/settings) y [Tattoo Studio Settings](https://langfuse.aiops.cloudpiles.net/project/tattoo-studio/settings) con una clave de organización, preservando credenciales, prefijos y programación. |
| verification/rollback | blocked | No existe proyecto no productivo ni observaciones representativas. Siguiente acción: enviar una ejecución de cada proyecto a un entorno no productivo, comprobar raíz/hijo, sesión, input/output y scores; mientras tanto se mantiene `dual`, sin backfill histórico, para permitir rollback. |

Las pruebas locales verifican el árbol de observaciones v4 y la propagación de contexto. La imagen desplegada de Agent Office es `sha256:a2b336457fa625faf3bef146d0a789a0903d48944f1626cadf66eefd72feb1b1`.
