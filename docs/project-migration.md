# Piloto de migración: Tattoo Studio

Tattoo Studio está registrado en Agent Office como un proyecto de `read_only_context`. Es una primera migración de contexto: no monta el checkout del cliente, no usa sus credenciales ni puede operar su cuenta AWS, datos, CI/CD o generación de imágenes.

El paquete versionado en `services/agent-office/project-contexts/tattoo-studio.md` incluye la arquitectura y operación documentadas. El registro en `services/agent-office/projects.json` limita el piloto a Orchestrator, Research y Review. Las ejecuciones, eventos y trazas llevan el identificador `tattoo-studio`; DynamoDB los guarda bajo una partición distinta de la plataforma.

Para probarlo en Agent Office:

1. Iniciar sesión con Entra ID en `https://aiops.cloudpiles.net`.
2. En **Proyecto**, elegir **Fede Rod Tattoo Studio**.
3. Asignar la tarea a **Research** y usar este pedido:

   ```text
   Revisa la arquitectura declarada y el flujo de generación asíncrona. Entrega los riesgos operativos priorizados, las evidencias del paquete de contexto y un plan de validación sin ejecutar cambios.
   ```

4. Verificar que la tarea, los eventos y la traza de Langfuse muestran `project_id=tattoo-studio` y que la respuesta identifica las fuentes usadas.

El criterio de salida de esta etapa es una respuesta trazable y útil sin efectos externos. El siguiente paso, sólo después de revisar el resultado, sería sincronizar un paquete de contexto desde una revisión concreta del repositorio y evaluar un rol de auditoría cruzada separado para la cuenta de Tattoo Studio.
