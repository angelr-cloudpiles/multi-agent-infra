# Operación de Bedrock AgentCore y Langfuse

## Límites y protección de Bedrock

Los límites de gasto se administran con AWS Budgets y las cuotas se aplican en Amazon Bedrock. Los guardrails se asocian a los harnesses de AgentCore. No se utilizan claves virtuales ni un proxy de modelos.

## Organizaciones y proyectos

| Organización | Proyecto Langfuse | Runtime |
| --- | --- | --- |
| Cloudpiles | Gaudi (`multi-agent`) | Bedrock AgentCore |
| fede-rod-tattoo | Fede Rod Tattoo Studio (`tattoo-studio`) | Bedrock AgentCore |

Cada proyecto tiene sus propias credenciales de ingestión Langfuse, contexto versionado y repositorio asociado en `services/agent-office/projects.json`.

## Prompts y evaluación

La sincronización publica versiones nuevas con la etiqueta `staging`. El runtime sólo lee `production`. Para promover una versión se requiere un informe de evaluación que cumpla los umbrales de `config/langfuse/projects.json`:

```sh
node scripts/promote-langfuse-prompt.mjs \
  --project=tattoo-studio \
  --prompt=agents.orchestrator-agent.system \
  --version=2 \
  --evaluation-report=config/langfuse/evaluation-report.example.json \
  --dry-run
```

`scripts/sync-langfuse-evaluators.mjs` registra por proyecto una conexión Bedrock que usa el rol ECS de Langfuse, los evaluadores `response_quality` y `safety_review`, y una regla activa sobre el 10% de las generaciones. La instancia está en Langfuse v4 con escritura `dual`; no se habilitó el backfill histórico hasta comprobar la propagación en producción.

El estado detallado de la migración a observaciones v4, incluidos los controles pendientes de exportación y la validación no productiva, está en [LANGFUSE-V4-MIGRATION.md](LANGFUSE-V4-MIGRATION.md).

## Costos

Langfuse sólo debe recibir precios personalizados cuando el SKU de AWS Price List coincida exactamente con el modelo e inference profile que se invoca. Al 2026-09-14, AWS Price List no publica coincidencias de `us-east-1` para varios identificadores configurados (`us.openai.gpt-*`, `us.anthropic.claude-*-5`, `us.amazon.nova-pro-v1:0`). Esos modelos se mantienen sin una tarifa personalizada para evitar reportar costos falsos. Cuando AWS publique el SKU, se debe cargar su precio por token y validarlo frente a Cost and Usage Report antes de promoverlo a Langfuse.

## Exports

Langfuse tiene batch export habilitado hacia el bucket S3 cifrado de la plataforma, con prefijo `exports/`. Esta capacidad genera archivos sólo cuando un usuario solicita un export desde Langfuse.

La instancia corre Langfuse OSS 4.35.0. Las claves de organización y la integración Blob Storage gestionada son capacidades de Enterprise Edition, por lo que no se usan como requisito operativo. El task Fargate `multi-agent-agent-office-langfuse-export` ejecuta todos los días a las 03:10 UTC y consulta cada proyecto con su propia clave. Escribe Parquet en `exports/project-api/{project}/date={YYYY-MM-DD}/`, con archivos separados para observaciones y scores más `manifest.json`.

El exportador solicita sólo los grupos `core`, `basic`, `time`, `metadata`, `model`, `usage`, `metrics` y `trace_context` de observaciones. No solicita ni persiste `input` ni `output`. El rol tiene acceso de lectura únicamente a los dos secretos de proyecto y de escritura sólo bajo ese prefijo de S3 con KMS. Para una ejecución de recuperación se puede lanzar la misma task con `EXPORT_DATE=YYYY-MM-DD`; la escritura reemplaza los objetos de esa partición y S3 conserva la versión previa.

## Respaldo de la migración v4

Antes de Langfuse v4 se creó el snapshot RDS `multi-agent-langfuse-pre-v4-20260914` y un recovery point de AWS Backup para el EFS de ClickHouse. EFS tiene backups automáticos habilitados. ClickHouse se actualizó a 25.12, el mínimo soportado por Langfuse v4.
