# Manual de integración de agentes desde el IDE

VS Code, Kiro y OpenCode son el espacio para desarrollar y conversar con los agentes. [AIOps](https://aiops.cloudpiles.net) es el visualizador: muestra estado, tareas, alertas y trazas en Langfuse. Los IDEs se conectan a AgentCore mediante el puente MCP local `agent-ide-mcp`; nunca reciben claves AWS, Langfuse, GitHub ni LiteLLM.

El puente inicia sesión con Entra ID a través de Cognito usando Authorization Code con PKCE. El cliente OAuth es público y exclusivo para IDEs, separado del cliente de la aplicación web. La sesión renovable queda en `~/.config/aiops-agent-mcp/session.json`, con permisos de usuario `0600`.

## Preparación inicial

Instale Node.js 22 o posterior. Una vez por estación de trabajo, obtenga el puente e inicie sesión:

```bash
git clone https://github.com/angelr-cloudpiles/multi-agent-infra.git ~/src/multi-agent-infra
cd ~/src/multi-agent-infra/tools/agent-ide-mcp
npm ci
npm run login
```

El último comando abre Entra ID en el navegador y espera el retorno local en `http://127.0.0.1:19876/oauth/callback`. No copie tokens en ningún archivo de proyecto. Para cambiar de cuenta, elimine `~/.config/aiops-agent-mcp/session.json` y ejecute `npm run login` nuevamente.

El puente obtiene por HTTPS la configuración pública del Gateway. Su único acceso de red posterior es la API Gateway autenticada; todos los accesos a proyecto, agente y tarea se validan de nuevo en el servidor.

## Herramientas disponibles

| Herramienta | Acción |
| --- | --- |
| `projects.list` | Lista los proyectos que puede usar la identidad actual. |
| `agents.list` | Lista los agentes habilitados en un proyecto. |
| `tasks.create` | Crea una tarea raíz explícita. Usa `orchestrator-agent` por defecto. |
| `agents.chat` | Inicia o continúa una conversación. El primer mensaje crea la tarea raíz; los siguientes reutilizan `task_id`. |
| `tasks.status` | Devuelve estado, resultados e identificadores de ejecución. |
| `tasks.messages` | Recupera el hilo de una tarea raíz. |
| `tasks.continue` | Aporta una decisión o información a una tarea existente. |

`tattoo-studio` conserva su política de solo lectura: puede analizar y proponer cambios, pero no mutar AWS, CI/CD ni el repositorio. La identidad de memoria contiene proyecto, agente, usuario seudonimizado y tarea, por lo que un contexto no se mezcla entre proyectos.

## VS Code

En el repositorio de trabajo, cree `.vscode/mcp.json` y sustituya `<RUTA_AL_REPOSITORIO_DE_PLATAFORMA>` por la ruta absoluta que clonó durante la preparación.

```json
{
  "servers": {
    "aiops-agents": {
      "type": "stdio",
      "command": "node",
      "args": [
        "<RUTA_AL_REPOSITORIO_DE_PLATAFORMA>/tools/agent-ide-mcp/index.mjs",
        "serve"
      ]
    }
  }
}
```

Abra **MCP: List Servers** y confirme que `aiops-agents` está conectado. Use primero `projects.list`, elija el proyecto que coincide con el repositorio abierto y luego pida al agente que use `agents.chat` o `tasks.create`. VS Code admite esta configuración local en `.vscode/mcp.json` con transporte stdio. Consulte la [referencia MCP de VS Code](https://code.visualstudio.com/docs/agents/reference/mcp-configuration).

## Kiro

En el repositorio de trabajo, cree `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "aiops-agents": {
      "command": "node",
      "args": [
        "<RUTA_AL_REPOSITORIO_DE_PLATAFORMA>/tools/agent-ide-mcp/index.mjs",
        "serve"
      ],
      "disabled": false
    }
  }
}
```

Guarde y abra el panel MCP. Kiro reconecta el servidor al guardar. No agregue `autoApprove`: la creación de tareas y las continuaciones deben permanecer visibles para quien está trabajando. La configuración de espacio de trabajo y el formato `mcpServers` están documentados por [Kiro](https://kiro.dev/docs/mcp/configuration/).

## OpenCode

En la raíz del repositorio de trabajo, cree o actualice `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "aiops-agents": {
        "type": "local",
        "command": [
          "node",
          "<RUTA_AL_REPOSITORIO_DE_PLATAFORMA>/tools/agent-ide-mcp/index.mjs",
          "serve"
        ],
        "codemode": false
      }
    }
  }
}
```

Verifique la conexión con `opencode mcp list` o `/mcps`. OpenCode usa `mcp.servers` para servidores locales y puede exponer las herramientas de este puente directamente cuando `codemode` es `false`; consulte la [documentación de MCP de OpenCode](https://opencode.ai/v2/docs/mcp-servers).

## Forma de trabajo

1. Abra el repositorio y compruebe rama, cambios locales y pruebas antes de delegar.
2. Ejecute `projects.list` y confirme el proyecto. El manifiesto local `.aiops/project.json`, si existe, es sólo una ayuda: la autorización central es la fuente de verdad.
3. Use `agents.chat` con `orchestrator-agent` para aclarar alcance o continuar una tarea. Guarde el `task_id` que devuelve la primera interacción.
4. Use `tasks.create` cuando ya exista un objetivo verificable que requiera ejecución independiente.
5. Use `tasks.status` y `tasks.messages` para seguir el trabajo. AIOps reflejará el mismo `run_id` y las trazas estarán en el proyecto Langfuse correspondiente.
6. Cuando el agente pida atención, responda con `tasks.continue` usando el mismo `task_id`; no abra una tarea nueva por cada mensaje.
7. Revise cambios, pruebas y autorizaciones de despliegue en el IDE. Una tarea finalizada no autoriza por sí misma un PR o un despliegue.

## Validación y resolución de problemas

| Comprobación | Resultado esperado |
| --- | --- |
| `npm run login` | Redirige a Entra ID y termina con “IDE session ready”. |
| IDE conectado | `projects.list` aparece entre las herramientas. |
| Proyecto | `projects.list` devuelve sólo proyectos permitidos. |
| Primera conversación | Devuelve `task_id` y aparece en AIOps. |
| Continuación | Reutiliza el mismo `task_id`; no crea una tarea raíz adicional. |
| Proyecto de solo lectura | El agente puede analizar, pero el Gateway conserva las restricciones de mutación. |

Si el login indica que el puerto está ocupado, cierre el proceso que usa `127.0.0.1:19876` y vuelva a iniciar el flujo. Si el IDE no lista herramientas, ejecute `npm test` desde `tools/agent-ide-mcp` y confirme que la ruta absoluta del archivo `index.mjs` coincide con la configuración. Si la sesión caducó o se revocó, elimine el archivo de sesión y vuelva a iniciar sesión.

## Límites de seguridad

- No guarde tokens, API keys, secretos AWS, PATs de GitHub ni contraseñas en archivos MCP o de proyecto.
- El puente es local únicamente para el transporte MCP. Las decisiones de autorización y la ejecución permanecen en API Gateway, Agent Office y Bedrock AgentCore.
- Entregue al agente sólo archivos seleccionados, diff o referencias Git. No incluya `.env`, claves ni credenciales en mensajes o adjuntos.
- La creación de ramas, PRs y despliegues requiere una integración de repositorio y política de aprobación aparte; no se habilita por el puente actual.
