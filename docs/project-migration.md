# Piloto de migración: Tattoo Studio

Tattoo Studio está registrado en Agent Office como un proyecto de `read_only_context`. Su contexto se sincroniza desde una revisión concreta de Git; no monta el checkout del cliente, no usa sus credenciales ni puede operar su cuenta AWS, datos, CI/CD o generación de imágenes.

El paquete versionado en `services/agent-office/project-contexts/tattoo-studio.md` incluye extractos de código, infraestructura, pruebas y operación, con repositorio, revisión y hashes de procedencia. El registro en `services/agent-office/projects.json` limita el piloto a Orchestrator, Research, Review y UI Design.

El proyecto se administra en las plataformas de control, no solo en Agent Office:

- Langfuse: proyecto `tattoo-studio` (`Fede Rod Tattoo Studio`) en la organización `Cloudpiles`, con una clave de ingestión exclusiva en Secrets Manager.
- Bedrock AgentCore: runtime administrado con política de modelos en `services/agent-office/agent-profiles.json` y el catálogo de modelos versionado del servidor.

`GET /api/projects/tattoo-studio/control` requiere sesión de Entra ID y devuelve el proyecto Langfuse y el runtime Bedrock AgentCore, sin exponer claves. Agent Office usa la clave de Langfuse correspondiente para cada traza y consulta las trazas por proyecto. DynamoDB queda como estado de conversación y cola de Agent Office, no como catálogo de observabilidad.

Para probarlo en Agent Office:

1. Iniciar sesión con Entra ID en `https://aiops.cloudpiles.net`.
2. En **Proyecto**, elegir **Fede Rod Tattoo Studio**.
3. Asignar la tarea a **Research** y usar este pedido:

   ```text
   Revisa la arquitectura declarada y el flujo de generación asíncrona. Entrega los riesgos operativos priorizados, las evidencias del paquete de contexto y un plan de validación sin ejecutar cambios.
   ```

4. Verificar `GET /api/projects/tattoo-studio/control` y confirmar que devuelve Langfuse `tattoo-studio` y runtime `bedrock-agentcore`.
5. Verificar que la tarea, los eventos y la traza aparecen dentro del proyecto **Fede Rod Tattoo Studio** de Langfuse y que la respuesta identifica las fuentes usadas.

El criterio de salida de esta etapa es una respuesta trazable y útil sin efectos externos. Las invocaciones de los harnesses de AgentCore usan Bedrock directamente. Los costos, presupuestos, cuotas y guardrails se administran en AWS. Para actualizar la fuente, usar `TATTOO_STUDIO_REPOSITORY=/ruta/al/checkout npm run sync:tattoo-context`; el script toma exclusivamente `HEAD`, registra hashes y excluye cambios locales sin commit.
